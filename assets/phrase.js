/* 日本語の改行位置を制御する
 *
 * 方針：段落（p・li・見出し）ごとに全文をつなげて BudouX で文節に分け、
 * 「改行してよい位置」と「その間のかたまり」を決める。かたまりはリンクなどの要素をまたいでいても
 * ひとつの <span class="nw">（white-space: nowrap）にまとめ、かたまりの間にだけ <wbr> を置く。
 * こうすると、単語の途中・カッコの前後・句読点の前などでは改行されない。
 *
 * BudouX の結果に加えるルール（ここで文節をつなげる）
 *   ・開きカッコの直前と直後では改行しない（「藩主（幕末）」の「（幕末）」だけが次の行に行かない）
 *   ・閉じカッコ・句読点・中黒・長音などの直前では改行しない
 *   ・英数字が続く部分（CC BY-SA 4.0 など）は分けない
 *   ・もともと <span class="nw"> で囲んである部分の中では改行しない
 */
(function () {
  'use strict';
  var OPEN = '（(「『【〔［[〈《';
  var NO_HEAD = '）)」』】〕］]〉》、。，．,.・：:；;？?！!ー〜…％%―';
  var ASCII = /[A-Za-z0-9_\-./:@#]/;
  var BLOCKS = 'p, li, h1, h2, h3, h4, dt, dd, figcaption';

  function phrases(text) {
    var parse = window.BudouxJa && window.BudouxJa.parse;
    return parse ? parse(text) : [text];
  }

  // 文字列 text の中で改行してよい位置（文字オフセット）の集合を返す
  // 文字種：漢字 / カタカナ / ひらがな / 英数字 / その他
  function kind(ch) {
    if (/[\u4E00-\u9FFF\u3005\u3006\u30F6]/.test(ch)) return 'K';
    if (/[\u30A0-\u30FF]/.test(ch)) return 'T';
    if (/[\u3040-\u309F]/.test(ch)) return 'H';
    if (ASCII.test(ch)) return 'A';
    return 'O';
  }
  var LONG = 9; // これより長い文節は、文字種の切り替わり（ひらがなへの切り替わりは除く）でも改行してよい

  function breakPoints(text) {
    var ps = phrases(text), pts = [], pos = 0;
    for (var i = 0; i < ps.length; i++) {
      var ph = ps[i];
      if (ph.length > LONG) {
        for (var j = 1; j < ph.length; j++) {
          var ka = kind(ph.charAt(j - 1)), kb = kind(ph.charAt(j));
          if (ka !== kb && kb !== 'H' && kb !== 'O' && ka !== 'O' && !(ka === 'A' && kb === 'K')) pts.push(pos + j);
        }
      }
      pos += ph.length;
      if (i < ps.length - 1) pts.push(pos);
    }
    return pts.filter(function (p) {
      var a = text.charAt(p - 1), b = text.charAt(p);
      if (OPEN.indexOf(b) >= 0 || NO_HEAD.indexOf(b) >= 0 || OPEN.indexOf(a) >= 0) return false;
      if (ASCII.test(a) && (ASCII.test(b) || b === ' ')) return false;
      if (a === ' ' && ASCII.test(b)) return false;
      return true;
    });
  }

  // ブロック内のテキストを「部品」に分解する：{text, chain:[祖先要素…], atomic}
  function collect(block) {
    var pieces = [];
    (function walk(node, chain) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var t = c.data.replace(/\s+/g, ' ');
          if (t) pieces.push({ text: t, chain: chain, atomic: false });
        } else if (c.nodeType === 1) {
          var tag = c.tagName;
          if (tag === 'WBR') { pieces.push({ wbr: true, chain: chain }); continue; }
          if (tag === 'BR') { pieces.push({ br: true, chain: chain }); continue; }
          if (c.classList.contains('nw') || /^(SVG|IMG|svg|img|INPUT|BUTTON|SCRIPT|STYLE)$/.test(tag)) {
            pieces.push({ el: c, text: c.textContent.replace(/\s+/g, ' '), chain: chain, atomic: true });
            continue;
          }
          walk(c, chain.concat([c]));
        }
      }
    })(block, []);
    return pieces;
  }

  function process(block) {
    if (block.dataset.phrased) return;
    var pieces = collect(block);
    if (!pieces.length) return;
    // 全文と、改行禁止区間（atomic の中）
    var full = '', forbid = [], manual = [];
    pieces.forEach(function (p) {
      if (p.wbr) { manual.push(full.length); return; }
      if (p.br) { full += '\n'; return; }
      var start = full.length;
      full += p.text;
      if (p.atomic) forbid.push([start, full.length]);
    });
    // 手で入れた <wbr> の位置も改行してよい位置に加える
    var pts = breakPoints(full).concat(manual).filter(function (o) {
      return !forbid.some(function (r) { return o > r[0] && o < r[1]; });
    });
    var set = {}; pts.forEach(function (o) { set[o] = true; });

    // 区切り位置で部品を切り分けて、かたまり（segment）ごとに組み立て直す
    var out = document.createDocumentFragment();
    var seg = null, segChain = [], segClones = [];
    function newSeg() {
      seg = document.createElement('span');
      seg.className = 'nw';
      segChain = []; segClones = [];
    }
    function closeSeg() {
      if (seg && seg.childNodes.length) {
        if (out.childNodes.length && out.lastChild.nodeName !== 'BR') out.appendChild(document.createElement('wbr'));
        out.appendChild(seg);
      }
      seg = null;
    }
    // chain に対応する入れ子（浅いコピー）を seg の中に用意して、その一番内側を返す
    function containerFor(chain) {
      var k = 0;
      while (k < chain.length && k < segChain.length && chain[k] === segChain[k]) k++;
      segChain = segChain.slice(0, k); segClones = segClones.slice(0, k);
      var parent = k ? segClones[k - 1] : seg;
      for (var i = k; i < chain.length; i++) {
        var cl = chain[i].cloneNode(false);
        cl.removeAttribute('id');
        parent.appendChild(cl);
        segChain.push(chain[i]); segClones.push(cl);
        parent = cl;
      }
      return parent;
    }
    var pos = 0;
    newSeg();
    pieces.forEach(function (p) {
      if (p.wbr) return;
      if (p.br) {
        closeSeg();
        out.appendChild(document.createElement('br'));
        pos += 1; newSeg(); return;
      }
      if (p.atomic) {
        if (set[pos]) { closeSeg(); newSeg(); }
        containerFor(p.chain).appendChild(p.el);
        pos += p.text.length; return;
      }
      var t = p.text, i = 0;
      while (i < t.length) {
        if (set[pos + i] && seg.childNodes.length) { closeSeg(); newSeg(); }
        // 次の区切りまで
        var j = i + 1;
        while (j < t.length && !set[pos + j]) j++;
        containerFor(p.chain).appendChild(document.createTextNode(t.slice(i, j)));
        i = j;
      }
      pos += t.length;
    });
    closeSeg();
    while (block.firstChild) block.removeChild(block.firstChild);
    block.appendChild(out);
    block.dataset.phrased = '1';
  }

  function apply(root) {
    if (!root) return;
    var blocks = [];
    if (root.matches && root.matches(BLOCKS)) blocks.push(root);
    root.querySelectorAll(BLOCKS).forEach(function (b) { if (!b.querySelector(BLOCKS)) blocks.push(b); });
    blocks.forEach(function (b) { delete b.dataset.phrased; process(b); });
  }

  window.Phrase = { apply: apply, breakPoints: breakPoints };
})();
