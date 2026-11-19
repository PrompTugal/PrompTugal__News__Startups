// Open calls on startups.promptugal.news: the days left, worked out in the reader's browser (Dinis, 19 November 2026,
// about 01:13 UTC: "load the data in the browser"; PrompTugal__News__Website
// board/guidance/2026-11-19-load-the-data-in-the-browser.md). The page is built with each call's closing date in
// data-closes and its built text as the fallback. Here each one is worked out again against today's date in Lisbon
// (the deadlines are Portuguese dates), on the reader's own clock: "N days left", "closes today" or "closed". Nothing is
// fetched, stored or sent; every value is written with textContent. A page without data-closes is left as it is.
(() => {
    'use strict'
    try {
        const els = document.querySelectorAll('[data-closes]')
        const asof = document.getElementById('calls-asof')
        if (!els.length && !asof) return
        const ISO = /^\d{4}-\d{2}-\d{2}$/
        let today = ''
        try { today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) } catch { }
        if (!ISO.test(today)) return                                          // no usable clock: keep the built text
        const day = iso => Date.parse(iso + 'T00:00:00Z') / 86400000
        const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const W = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const nice = iso => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
        const closes = iso => `${W[new Date(iso + 'T00:00:00Z').getUTCDay()]} ${nice(iso)}`
        for (const el of els) {
            const d = el.getAttribute('data-closes')
            if (!ISO.test(d || '')) continue
            const left = day(d) - day(today)
            if (!isFinite(left)) continue
            el.textContent = left > 0 ? `closes ${closes(d)} (${left} day${left === 1 ? '' : 's'} left)` : left === 0 ? `closes ${closes(d)} (closes today)` : `closed ${closes(d)}`
            const item = el.closest('li')
            if (item) {
                item.classList.toggle('call-closed', left < 0)
                const soon = item.querySelector('[data-soon]')
                if (soon) soon.hidden = !(left >= 0 && left <= 14)
            }
        }
        if (asof) {
            const built = asof.getAttribute('data-built') || ''
            if (ISO.test(built) && built !== today) asof.textContent = `This list was built on ${nice(built)}. The days left are worked out in your browser for today, ${nice(today)} (Lisbon); a call shown as closed has passed its date since the list was built.`
            else asof.textContent = `This list was built today, ${nice(today)}; the days left are worked out in your browser.`
        }
    } catch { }
})()
