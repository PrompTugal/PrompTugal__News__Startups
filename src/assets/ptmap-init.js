// Draws the shared map (ptmap) from the JSON the page carries in <script type="application/json" id="ptmap-data">.
// No inline script runs; nothing is fetched. Written by startups.b@PrompTugal.dinis, 19 Nov 2026.
(function () {
  'use strict'
  function go () {
    var host = document.getElementById('ptmap'), data = document.getElementById('ptmap-data')
    if (!host || !data || !window.PTMap) return
    var o; try { o = JSON.parse(data.textContent) } catch (e) { return }
    window.PTMap.render(host, o)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go()
})()
