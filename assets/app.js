/* ここは何藩？ 試作版
 * データ：data/ryobun.topojson（領分の組み合わせごとの領域 r ＋ 旧国 k）、data/han.json（領分→藩ID・藩主など）
 */
(function () {
  'use strict';

  var WIKI = 'https://ja.wikipedia.org/wiki/';
  // 明治元年12月（1869年1月）に分割された国 → 慶応4年1月1日時点の国名
  var SPLIT = { '岩代': '陸奥', '磐城': '陸奥', '陸前': '陸奥', '陸中': '陸奥', '羽前': '出羽', '羽後': '出羽' };
  var KIND_COLOR = { tenryo: '#b9a06a', hatamoto: '#b7a9cf', jisha: '#d99a86', other: '#bdbdbd' };

  var statusEl = document.getElementById('status');
  var sheet = document.getElementById('sheet');
  var body = document.getElementById('sheet-body');
  var btn = document.getElementById('locate');

  var RB = [];          // 領分情報の配列（han.json）
  var feats = [];       // 領域 GeoJSON features（bbox 付き）
  var map, layerR, marker, accCircle, hiLayer, topo;

  // ---------- 文字列ユーティリティ ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 改行させたくない語句（名前＋カッコ書きなど）をひとかたまりにする
  function nw(s) { return '<span class="nw">' + esc(s) + '</span>'; }
  function wl(title, text) {
    return '<a href="' + WIKI + encodeURIComponent(title) + '" target="_blank" rel="noopener">' + text + '</a>';
  }

  // ---------- 色 ----------
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function colorOf(rb) {
    if (!rb) return '#cccccc';
    if (rb.kind !== 'han') return KIND_COLOR[rb.kind] || KIND_COLOR.other;
    var h = hash(rb.id || rb.src);
    var hue = h % 360, sat = 50 + (h >> 9) % 25, lig = 52 + (h >> 17) % 16;
    return 'hsl(' + hue + ',' + sat + '%,' + lig + '%)';
  }

  // ---------- 幾何 ----------
  function bboxOf(geom) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    polys.forEach(function (p) { p[0].forEach(function (c) {
      if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1];
      if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1];
    }); });
    return b;
  }
  function inRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inGeom(x, y, geom) {
    var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (var p = 0; p < polys.length; p++) {
      if (!inRing(x, y, polys[p][0])) continue;
      var hole = false;
      for (var h = 1; h < polys[p].length; h++) if (inRing(x, y, polys[p][h])) { hole = true; break; }
      if (!hole) return true;
    }
    return false;
  }
  function lookup(lat, lng) {
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i], b = f.bbox;
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      if (inGeom(lng, lat, f.geometry)) return f;
    }
    return null;
  }

  // ---------- 表示 ----------
  function setSheetHeight() {
    var h = sheet.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sheet-h', (window.innerWidth >= 720 ? 0 : h) + 'px');
  }
  function setStatus(msg, isErr) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status' + (isErr ? ' err' : '');
    Phrase.apply(el);
    setSheetHeight();
  }

  function provinceHtml(k) {
    if (!k) return '<p class="big">不明</p>';
    var edo = SPLIT[k] || k;
    var html = '<p class="big">' + wl(edo + '国', nw(edo + '国')) + '</p>';
    if (SPLIT[k]) {
      html += '<p class="note">明治元年12月の<span class="nw">分割後は</span>' + wl(k + '国', nw(k + '国')) + '</p>';
    }
    return html;
  }

  function rbHtml(rb) {
    var c = colorOf(rb);
    var h = '<li class="rb" style="--c:' + c + '">';
    h += '<p class="rb-name">' + (rb.wiki ? wl(rb.wiki, nw(rb.name)) : nw(rb.name)) + '</p>';
    if (rb.kind === 'han') {
      var lord = rb.lord
        ? (rb.lordWiki ? wl(rb.lordWiki, nw(rb.lord)) : nw(rb.lord))
        : (rb.lordNote ? '' : '不明');
      h += '<p class="rb-row"><span class="k nw">藩主（幕末）</span>' + lord + '</p>';
      if (rb.lordNote) h += '<p class="rb-row note">' + esc(rb.lordNote) + '</p>';
    } else if (rb.lordNote) {
      h += '<p class="rb-row note">' + esc(rb.lordNote) + '</p>';
    }
    var links = [];
    if (rb.id) links.push('<a href="' + rb.codh + '" target="_blank" rel="noopener" class="nw">藩ID ' + rb.id + '（CODH）</a>');
    if (rb.src !== rb.name && rb.kind === 'han') links.push('<span class="nw note">元データの表記：' + esc(rb.src) + '</span>');
    if (links.length) h += '<p class="links">' + links.join(' ') + '</p>';
    return h + '</li>';
  }

  function show(lat, lng, how) {
    var f = lookup(lat, lng);
    var html = '';
    if (!f) {
      html += '<div class="sec"><p class="sec-h">この地点</p>' +
        '<p>この地点の<span class="nw">データはありません。</span>' +
        '<span class="nw">北海道・沖縄</span>、<span class="nw">海の上</span>、' +
        '<span class="nw">または集落境界の</span><span class="nw">対象外の場所</span>です。</p></div>';
      highlight(null);
    } else {
      var p = f.properties;
      var rbs = p.r.map(function (i) { return RB[i]; });
      html += '<div class="sec"><p class="sec-h">旧国</p>' + provinceHtml(p.k) + '</div>';
      html += '<div class="sec"><p class="sec-h"><span class="nw">領主・藩</span>（<span class="nw">慶応4年1月1日時点</span>・<span class="nw">推定</span>）</p>';
      if (rbs.length === 0) {
        html += '<p>不明</p>';
      } else {
        if (rbs.length > 1) {
          html += '<p class="note"><span class="nw">複数の領主が</span><span class="nw">支配する村</span>（<span class="nw">相給</span>）を<span class="nw">含みます。</span><span class="nw">石高の大きい順</span>です。</p>';
        }
        html += '<ul class="rb-list">' + rbs.map(rbHtml).join('') + '</ul>';
      }
      html += '</div>';
      highlight(p.r[0]);
    }
    html += '<p class="coord"><span class="nw">' + (how === 'gps' ? '現在地' : 'タップした地点') + '</span>' +
      '<span class="nw">（北緯' + lat.toFixed(4) + '°</span> <span class="nw">東経' + lng.toFixed(4) + '°）</span></p>';
    body.innerHTML = html;
    Phrase.apply(body);
    sheet.scrollTop = 0;
    setSheetHeight();

    if (!marker) marker = L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#a2322a', fillOpacity: 1 }).addTo(map);
    else marker.setLatLng([lat, lng]);
    keepVisible(lat, lng);
  }

  // 地点が下のカードや上のバーに隠れないように地図をずらす
  function keepVisible(lat, lng) {
    var size = map.getSize();
    var bottom = window.innerWidth >= 720 ? 0 : sheet.getBoundingClientRect().height;
    var top = document.querySelector('.bar').getBoundingClientRect().height;
    var pt = map.latLngToContainerPoint([lat, lng]);
    if (pt.y > size.y - bottom - 40 || pt.y < top + 40) {
      var targetY = top + (size.y - bottom - top) / 2;
      map.panBy([0, pt.y - targetY], { animate: true });
    }
  }

  function highlight(primaryIdx) {
    if (hiLayer) { map.removeLayer(hiLayer); hiLayer = null; }
    if (primaryIdx == null) return;
    // 同じ藩（主たる領主）の領域をまとめて強調。内側の境界は描かず外周だけ太線にする
    var geoms = topo.objects.r.geometries.filter(function (g) { return g.properties.r[0] === primaryIdx; });
    var coll = { type: 'GeometryCollection', geometries: geoms };
    hiLayer = L.layerGroup([
      L.geoJSON(topojson.merge(topo, geoms), { interactive: false, style: { stroke: false, fillColor: colorOf(RB[primaryIdx]), fillOpacity: 0.6 } }),
      L.geoJSON(topojson.mesh(topo, coll, function (a, b) { return a === b; }), { interactive: false, style: { color: '#2b2118', weight: 2.5, opacity: 0.9 } })
    ]).addTo(map);
  }

  // ---------- 地図 ----------
  function initMap() {
    map = L.map('map', { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([36.2, 137.8], 6);
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.attributionControl.setPrefix('<a href="credits.html">出典</a> | <a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 5,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
    }).addTo(map);
    map.on('click', function (e) { show(e.latlng.lat, e.latlng.lng, 'tap'); });
    // 上部バーの分だけ余白
    var top = document.querySelector('.bar').getBoundingClientRect().height;
    document.querySelectorAll('.leaflet-top').forEach(function (el) { el.style.top = top + 'px'; });
  }

  function drawData(tj) {
    topo = tj;
    var r = topojson.feature(tj, tj.objects.r);
    feats = r.features.filter(function (f) { return f.geometry; });
    feats.forEach(function (f) { f.bbox = bboxOf(f.geometry); });
    var renderer = L.canvas({ padding: 0.3 });
    layerR = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
      renderer: renderer, interactive: false,
      style: function (f) {
        return { color: '#ffffff', weight: 0.4, opacity: 0.7, fillColor: colorOf(RB[f.properties.r[0]]), fillOpacity: 0.42 };
      }
    }).addTo(map);
    // 旧国の境界（藩領域と同じ元データから作成）
    var k = topojson.mesh(tj, tj.objects.k, function (a, b) { return a !== b; });
    L.geoJSON(k, { renderer: renderer, interactive: false, style: { color: '#3a2a1a', weight: 1.6, opacity: 0.85 } }).addTo(map);
    // 旧国名ラベル
    var labels = L.layerGroup();
    tj.objects.k.geometries.forEach(function (g) {
      var p = g.properties.p;
      labels.addLayer(L.tooltip({ permanent: true, direction: 'center', className: 'prov-label', interactive: false })
        .setLatLng([p[1], p[0]]).setContent(g.properties.n + '国'));
    });
    function toggleLabels() { if (map.getZoom() >= 7) labels.addTo(map); else map.removeLayer(labels); }
    map.on('zoomend', toggleLabels); toggleLabels();
  }

  // ---------- 現在地 ----------
  function locate() {
    if (!('geolocation' in navigator)) { setStatus('この端末・ブラウザでは位置情報が使えません。地図をタップしてください。', true); return; }
    if (!window.isSecureContext) { setStatus('位置情報は https のページでのみ使えます。地図をタップしてください。', true); return; }
    btn.disabled = true;
    setStatus('現在地を取得中…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      map.setView([lat, lng], Math.max(map.getZoom(), 11));
      if (accCircle) map.removeLayer(accCircle);
      accCircle = L.circle([lat, lng], { radius: pos.coords.accuracy, color: '#a2322a', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      show(lat, lng, 'gps');
    }, function (err) {
      btn.disabled = false;
      var msg = err.code === 1
        ? '位置情報の利用が許可されていません。iPhoneでは「設定」→「プライバシーとセキュリティ」→「位置情報サービス」→「Safari」で「使用中のみ」を選んでください。'
        : '現在地を取得できませんでした。地図をタップしても調べられます。';
      setStatus(msg, true);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  btn.addEventListener('click', locate);

  // ---------- 起動 ----------
  initMap();
  Phrase.apply(body);
  setSheetHeight();
  window.addEventListener('resize', setSheetHeight);
  // アプリ版（ローカルのHTMLを直接開く場合）は data/data.js に埋め込んだデータを使う。Web版は fetch で読む
  var embedded = window.KOKOHAN_DATA;
  (embedded ? Promise.resolve([embedded.han, embedded.topo]) : Promise.all([
    fetch('data/han.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('data/ryobun.topojson').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  ])).then(function (res) {
    RB = res[0].ryobun;
    drawData(res[1]);
    setStatus('準備ができました。');
  }).catch(function (e) {
    setStatus('データの読み込みに失敗しました（' + e.message + '）。', true);
  });
})();
