// PrompTugal.news's page views and reads (observability@PrompTugal.dinis, 6 November 2026, at Dinis Cruz's word:
// "replicate what we have on web-summit.sgit.ai"). The team site's sender (its assets/obs-dinis.js, by
// observability@web-summit.dinis, after Jose's assets/telemetry.js and the observability pack), into this site's own
// vault (assets/obs/obs.json). Two events per page load:
//   view  when the page loads;
//   read  the first time the tab is hidden or closed: seconds the page was visible and the deepest scroll (percent).
// Each says: the page, the referring site (host only), the time to the minute, the site version, a random id that
// ends with the tab, the screen size class, the browser's language and time zone, an automation class if a bot
// declares itself, and the country from the browser's own time zone (no network call; the IP lookup was removed on
// 19 November 2026 at Dinis's word). No IP address, no cookie, no user-agent
// string, no browser fingerprint. Sealed here to the drain key (sgit hybrid
// envelope v2: RSA-OAEP-SHA256 + AES-256-GCM) and written to a write-only append lane; on 507 (a lane full) the next.
// Do Not Track, Global Privacy Control and the footer's Pause switch stop it. Never blocks, never shows an error.
// The drain (newsroom/tools/obs/obs_drain.py) publishes counts only; the report is /newsroom/observability/.
(() => {
    'use strict'
    try {
        const nav = navigator
        const dnt = nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl === true
        const LS = { get: k => { try { return localStorage.getItem('pt.obs.' + k) } catch { return null } }, set: (k, v) => { try { v === null ? localStorage.removeItem('pt.obs.' + k) : localStorage.setItem('pt.obs.' + k, v) } catch { } } }
        const SS = { get: k => { try { return sessionStorage.getItem('pt.obs.' + k) } catch { return null } }, set: (k, v) => { try { sessionStorage.setItem('pt.obs.' + k, v) } catch { } }, del: k => { try { sessionStorage.removeItem('pt.obs.' + k) } catch { } } }
        const paused = () => LS.get('off') === '1'
        const script = document.currentScript, base = script ? script.src.replace(/obs\.js(\?.*)?$/, '') : '/assets/obs/'

        // the disclosure and the pause switch, in the footer of every page
        const footer = () => {
            const row = document.querySelector('footer .row p.small') || document.querySelector('footer .row'); if (!row || row.querySelector('.obs-note')) return
            const s = document.createElement('span'); s.className = 'obs-note'
            const a = document.createElement('a'); a.href = 'https://promptugal.news/newsroom/observability/index.html'; a.textContent = 'what is counted'
            if (dnt) { s.append(' · Page views: off (Do Not Track or Global Privacy Control is on). ', a); row.appendChild(s); return }
            const b = document.createElement('button'); b.type = 'button'; b.style.cssText = 'font:inherit;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer;color:inherit'
            const t = document.createTextNode('')
            const draw = () => { t.textContent = paused() ? ' · Page views: paused on this device. ' : ' · Page views, reading time and your country are counted, publicly. The country comes from your browser\'s time zone; no one is asked where you are, and we keep no IP and set no cookie. '; b.textContent = paused() ? 'Resume' : 'Pause' }
            b.onclick = () => { LS.set('off', paused() ? null : '1'); draw() }
            s.append(t, b, ' · ', a); draw(); row.appendChild(s)
        }
        const safeFooter = () => { try { footer() } catch { } }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeFooter); else safeFooter()
        if (dnt || paused()) return

        let sid = SS.get('sid'); if (!sid) { sid = [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(16).padStart(2, '0')).join(''); SS.set('sid', sid) }
        const path = location.pathname, done = new Set()

        const b64 = bytes => { let s = ''; for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x); return btoa(s) }
        const unpem = pem => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0))
        async function seal(pem, text) {
            const S = crypto.subtle
            const pub = await S.importKey('spki', unpem(pem), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
            const aes = await S.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
            const iv = crypto.getRandomValues(new Uint8Array(12))
            const c = await S.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aes, new TextEncoder().encode(text))
            const w = await S.encrypt({ name: 'RSA-OAEP' }, pub, await S.exportKey('raw', aes))
            return btoa(btoa(JSON.stringify({ v: 2, w: b64(w), i: b64(iv), c: b64(c) })))   // the lane takes base64 of the .enc text
        }
        // automation by class only, never the user-agent string itself
        const ua = nav.userAgent || ''
        const agent = nav.webdriver ? 'webdriver' : /HeadlessChrome|PhantomJS/.test(ua) ? 'headless'
            : /Googlebot/i.test(ua) ? 'googlebot' : /bingbot/i.test(ua) ? 'bingbot' : /bot|crawl|spider|slurp/i.test(ua) ? 'bot' : ''
        const w = window.innerWidth || 1024
        let ref = ''; try { ref = document.referrer ? new URL(document.referrer).host : '' } catch { }
        // the country only, from the browser's own time zone, with no network call (Dinis, 19 November 2026, about 03:15 UTC:
        // "remove the IP base. So we're going to keep the country still"; PrompTugal__News__Website
        // board/guidance/2026-11-19-no-ip-lookup-predictions-and-small-decisions.md). No third party is asked where a reader is;
        // region, city and map position are not sent. The table is the tz database's zone.tab (version 2026e, public domain),
        // country code to its zones, plus a few older names browsers still report; a zone not in it gives no country.
        const TZ = 'AD:Europe/Andorra;AE:Asia/Dubai;AF:Asia/Kabul;AG:America/Antigua;AI:America/Anguilla;AL:Europe/Tirane;AM:Asia/Yerevan;AO:Africa/Luanda;AQ:Antarctica/McMurdo,Antarctica/Casey,Antarctica/Davis,Antarctica/DumontDUrville,Antarctica/Mawson,Antarctica/Palmer,Antarctica/Rothera,Antarctica/Syowa,Antarctica/Troll,Antarctica/Vostok;AR:America/Argentina/Buenos_Aires,America/Argentina/Cordoba,America/Argentina/Salta,America/Argentina/Jujuy,America/Argentina/Tucuman,America/Argentina/Catamarca,America/Argentina/La_Rioja,America/Argentina/San_Juan,America/Argentina/Mendoza,America/Argentina/San_Luis,America/Argentina/Rio_Gallegos,America/Argentina/Ushuaia,America/Buenos_Aires;AS:Pacific/Pago_Pago;AT:Europe/Vienna;AU:Australia/Lord_Howe,Antarctica/Macquarie,Australia/Hobart,Australia/Melbourne,Australia/Sydney,Australia/Broken_Hill,Australia/Brisbane,Australia/Lindeman,Australia/Adelaide,Australia/Darwin,Australia/Perth,Australia/Eucla;AW:America/Aruba;AX:Europe/Mariehamn;AZ:Asia/Baku;BA:Europe/Sarajevo;BB:America/Barbados;BD:Asia/Dhaka,Asia/Dacca;BE:Europe/Brussels;BF:Africa/Ouagadougou;BG:Europe/Sofia;BH:Asia/Bahrain;BI:Africa/Bujumbura;BJ:Africa/Porto-Novo;BL:America/St_Barthelemy;BM:Atlantic/Bermuda;BN:Asia/Brunei;BO:America/La_Paz;BQ:America/Kralendijk;BR:America/Noronha,America/Belem,America/Fortaleza,America/Recife,America/Araguaina,America/Maceio,America/Bahia,America/Sao_Paulo,America/Campo_Grande,America/Cuiaba,America/Santarem,America/Porto_Velho,America/Boa_Vista,America/Manaus,America/Eirunepe,America/Rio_Branco;BS:America/Nassau;BT:Asia/Thimphu;BW:Africa/Gaborone;BY:Europe/Minsk;BZ:America/Belize;CA:America/St_Johns,America/Halifax,America/Glace_Bay,America/Moncton,America/Goose_Bay,America/Blanc-Sablon,America/Toronto,America/Iqaluit,America/Atikokan,America/Winnipeg,America/Resolute,America/Rankin_Inlet,America/Regina,America/Swift_Current,America/Edmonton,America/Cambridge_Bay,America/Inuvik,America/Vancouver,America/Creston,America/Dawson_Creek,America/Fort_Nelson,America/Whitehorse,America/Dawson;CC:Indian/Cocos;CD:Africa/Kinshasa,Africa/Lubumbashi;CF:Africa/Bangui;CG:Africa/Brazzaville;CH:Europe/Zurich;CI:Africa/Abidjan;CK:Pacific/Rarotonga;CL:America/Santiago,America/Coyhaique,America/Punta_Arenas,Pacific/Easter;CM:Africa/Douala;CN:Asia/Shanghai,Asia/Urumqi,Asia/Chongqing,Asia/Harbin;CO:America/Bogota;CR:America/Costa_Rica;CU:America/Havana;CV:Atlantic/Cape_Verde;CW:America/Curacao;CX:Indian/Christmas;CY:Asia/Nicosia,Asia/Famagusta;CZ:Europe/Prague;DE:Europe/Berlin,Europe/Busingen;DJ:Africa/Djibouti;DK:Europe/Copenhagen;DM:America/Dominica;DO:America/Santo_Domingo;DZ:Africa/Algiers;EC:America/Guayaquil,Pacific/Galapagos;EE:Europe/Tallinn;EG:Africa/Cairo;EH:Africa/El_Aaiun;ER:Africa/Asmara;ES:Europe/Madrid,Africa/Ceuta,Atlantic/Canary;ET:Africa/Addis_Ababa;FI:Europe/Helsinki;FJ:Pacific/Fiji;FK:Atlantic/Stanley;FM:Pacific/Chuuk,Pacific/Pohnpei,Pacific/Kosrae;FO:Atlantic/Faroe;FR:Europe/Paris;GA:Africa/Libreville;GB:Europe/London,GB;GD:America/Grenada;GE:Asia/Tbilisi;GF:America/Cayenne;GG:Europe/Guernsey;GH:Africa/Accra;GI:Europe/Gibraltar;GL:America/Nuuk,America/Danmarkshavn,America/Scoresbysund,America/Thule,America/Godthab;GM:Africa/Banjul;GN:Africa/Conakry;GP:America/Guadeloupe;GQ:Africa/Malabo;GR:Europe/Athens;GS:Atlantic/South_Georgia;GT:America/Guatemala;GU:Pacific/Guam;GW:Africa/Bissau;GY:America/Guyana;HK:Asia/Hong_Kong;HN:America/Tegucigalpa;HR:Europe/Zagreb;HT:America/Port-au-Prince;HU:Europe/Budapest;ID:Asia/Jakarta,Asia/Pontianak,Asia/Makassar,Asia/Jayapura;IE:Europe/Dublin,Eire;IL:Asia/Jerusalem;IM:Europe/Isle_of_Man;IN:Asia/Kolkata,Asia/Calcutta;IO:Indian/Chagos;IQ:Asia/Baghdad;IR:Asia/Tehran;IS:Atlantic/Reykjavik;IT:Europe/Rome;JE:Europe/Jersey;JM:America/Jamaica;JO:Asia/Amman;JP:Asia/Tokyo;KE:Africa/Nairobi;KG:Asia/Bishkek;KH:Asia/Phnom_Penh;KI:Pacific/Tarawa,Pacific/Kanton,Pacific/Kiritimati;KM:Indian/Comoro;KN:America/St_Kitts;KP:Asia/Pyongyang;KR:Asia/Seoul;KW:Asia/Kuwait;KY:America/Cayman;KZ:Asia/Almaty,Asia/Qyzylorda,Asia/Qostanay,Asia/Aqtobe,Asia/Aqtau,Asia/Atyrau,Asia/Oral;LA:Asia/Vientiane;LB:Asia/Beirut;LC:America/St_Lucia;LI:Europe/Vaduz;LK:Asia/Colombo;LR:Africa/Monrovia;LS:Africa/Maseru;LT:Europe/Vilnius;LU:Europe/Luxembourg;LV:Europe/Riga;LY:Africa/Tripoli;MA:Africa/Casablanca;MC:Europe/Monaco;MD:Europe/Chisinau;ME:Europe/Podgorica;MF:America/Marigot;MG:Indian/Antananarivo;MH:Pacific/Majuro,Pacific/Kwajalein;MK:Europe/Skopje;ML:Africa/Bamako;MM:Asia/Yangon,Asia/Rangoon;MN:Asia/Ulaanbaatar,Asia/Hovd;MO:Asia/Macau;MP:Pacific/Saipan;MQ:America/Martinique;MR:Africa/Nouakchott;MS:America/Montserrat;MT:Europe/Malta;MU:Indian/Mauritius;MV:Indian/Maldives;MW:Africa/Blantyre;MX:America/Mexico_City,America/Cancun,America/Merida,America/Monterrey,America/Matamoros,America/Chihuahua,America/Ciudad_Juarez,America/Ojinaga,America/Mazatlan,America/Bahia_Banderas,America/Hermosillo,America/Tijuana;MY:Asia/Kuala_Lumpur,Asia/Kuching;MZ:Africa/Maputo;NA:Africa/Windhoek;NC:Pacific/Noumea;NE:Africa/Niamey;NF:Pacific/Norfolk;NG:Africa/Lagos;NI:America/Managua;NL:Europe/Amsterdam;NO:Europe/Oslo;NP:Asia/Kathmandu,Asia/Katmandu;NR:Pacific/Nauru;NU:Pacific/Niue;NZ:Pacific/Auckland,Pacific/Chatham;OM:Asia/Muscat;PA:America/Panama;PE:America/Lima;PF:Pacific/Tahiti,Pacific/Marquesas,Pacific/Gambier;PG:Pacific/Port_Moresby,Pacific/Bougainville;PH:Asia/Manila;PK:Asia/Karachi;PL:Europe/Warsaw;PM:America/Miquelon;PN:Pacific/Pitcairn;PR:America/Puerto_Rico;PS:Asia/Gaza,Asia/Hebron;PT:Europe/Lisbon,Atlantic/Madeira,Atlantic/Azores,Portugal;PW:Pacific/Palau;PY:America/Asuncion;QA:Asia/Qatar;RE:Indian/Reunion;RO:Europe/Bucharest;RS:Europe/Belgrade;RU:Europe/Kaliningrad,Europe/Moscow,Europe/Kirov,Europe/Volgograd,Europe/Astrakhan,Europe/Saratov,Europe/Ulyanovsk,Europe/Samara,Asia/Yekaterinburg,Asia/Omsk,Asia/Novosibirsk,Asia/Barnaul,Asia/Tomsk,Asia/Novokuznetsk,Asia/Krasnoyarsk,Asia/Irkutsk,Asia/Chita,Asia/Yakutsk,Asia/Khandyga,Asia/Vladivostok,Asia/Ust-Nera,Asia/Magadan,Asia/Sakhalin,Asia/Srednekolymsk,Asia/Kamchatka,Asia/Anadyr;UA:Europe/Simferopol,Europe/Kyiv,Europe/Kiev;RW:Africa/Kigali;SA:Asia/Riyadh;SB:Pacific/Guadalcanal;SC:Indian/Mahe;SD:Africa/Khartoum;SE:Europe/Stockholm;SG:Asia/Singapore;SH:Atlantic/St_Helena;SI:Europe/Ljubljana;SJ:Arctic/Longyearbyen;SK:Europe/Bratislava;SL:Africa/Freetown;SM:Europe/San_Marino;SN:Africa/Dakar;SO:Africa/Mogadishu;SR:America/Paramaribo;SS:Africa/Juba;ST:Africa/Sao_Tome;SV:America/El_Salvador;SX:America/Lower_Princes;SY:Asia/Damascus;SZ:Africa/Mbabane;TC:America/Grand_Turk;TD:Africa/Ndjamena;TF:Indian/Kerguelen;TG:Africa/Lome;TH:Asia/Bangkok;TJ:Asia/Dushanbe;TK:Pacific/Fakaofo;TL:Asia/Dili;TM:Asia/Ashgabat;TN:Africa/Tunis;TO:Pacific/Tongatapu;TR:Europe/Istanbul,Asia/Istanbul;TT:America/Port_of_Spain;TV:Pacific/Funafuti;TW:Asia/Taipei;TZ:Africa/Dar_es_Salaam;UG:Africa/Kampala;UM:Pacific/Midway,Pacific/Wake;US:America/New_York,America/Detroit,America/Kentucky/Louisville,America/Kentucky/Monticello,America/Indiana/Indianapolis,America/Indiana/Vincennes,America/Indiana/Winamac,America/Indiana/Marengo,America/Indiana/Petersburg,America/Indiana/Vevay,America/Chicago,America/Indiana/Tell_City,America/Indiana/Knox,America/Menominee,America/North_Dakota/Center,America/North_Dakota/New_Salem,America/North_Dakota/Beulah,America/Denver,America/Boise,America/Phoenix,America/Los_Angeles,America/Anchorage,America/Juneau,America/Sitka,America/Metlakatla,America/Yakutat,America/Nome,America/Adak,Pacific/Honolulu,US/Eastern,US/Central,US/Mountain,US/Pacific;UY:America/Montevideo;UZ:Asia/Samarkand,Asia/Tashkent;VA:Europe/Vatican;VC:America/St_Vincent;VE:America/Caracas;VG:America/Tortola;VI:America/St_Thomas;VN:Asia/Ho_Chi_Minh,Asia/Saigon;VU:Pacific/Efate;WF:Pacific/Wallis;WS:Pacific/Apia;YE:Asia/Aden;YT:Indian/Mayotte;ZA:Africa/Johannesburg;ZM:Africa/Lusaka;ZW:Africa/Harare'
        const place = () => {
            const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
            let cc = ''
            for (const part of TZ.split(';')) { const i = part.indexOf(':'); if (part.slice(i + 1).split(',').includes(tz)) { cc = part.slice(0, i); break } }
            let name = ''; try { name = cc ? new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || '' : '' } catch { }
            return { country: String(name).slice(0, 60), country_code: cc }
        }
        // a link's tag (Dinis, 6 November: "I just sent a link to somebody ... I would like to see if they open it ... and
        // forward it"): ?via=<tag> (or utm_source / utm_campaign) on the link you send. Kept for the tab, so the pages read
        // after arriving count too; a tag names the link, never the person. Letters, digits, '.', '_' and '-', 40 at most.
        const tagOf = () => { try { const q = new URLSearchParams(location.search); const t = q.get('via') || q.get('utm_campaign') || q.get('utm_source') || ''; return /^[A-Za-z0-9._-]{1,40}$/.test(t) ? t.toLowerCase() : '' } catch { return '' } }
        let via = tagOf(); if (via) SS.set('via', via); else via = SS.get('via') || ''
        const common = () => {
            const e = { v: 1, src: 'promptugal', site: location.host, ver: ((document.querySelector('a.ver') || {}).textContent || '').trim(),
                ts: new Date().toISOString().slice(0, 16) + 'Z', sid, path, ref, lang: nav.language || '',
                screen: w < 600 ? 'phone' : w < 1000 ? 'tablet' : 'desktop', tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '') }
            if (agent) e.agent = agent
            if (via) e.via = via
            // an A/B test (Dinis, 6 November 2026, 13:20: "A/B testing when needed ... on the website"): the variant this page
            // was shown, from <html data-variant> or <meta name="variant">, set by whoever runs the test; no new identifier
            const H = document.documentElement.dataset, vr = H.variant || (document.querySelector('meta[name="variant"]') || {}).content || (H.top ? 'top-' + H.top : '')   // dev@'s A/B of the top: <html data-top="c|a">
            if (/^[A-Za-z0-9._-]{1,40}$/.test(vr)) e.variant = vr
            return e
        }

        let visibleMs = 0, since = document.visibilityState === 'visible' ? performance.now() : null, maxScroll = 0
        const scrolled = () => { const h = document.documentElement, top = window.scrollY || h.scrollTop, all = Math.max(1, h.scrollHeight - window.innerHeight); maxScroll = Math.max(maxScroll, Math.min(100, Math.round(100 * top / all))) }
        window.addEventListener('scroll', scrolled, { passive: true })

        let cfgP = null
        const cfg = () => cfgP || (cfgP = fetch(base + 'obs.json', { cache: 'no-cache' }).then(r => r.json()))
        const send = async ev => {
            if (paused()) return false
            const c = await cfg(); if (!c.enabled || !c.lanes || !c.lanes.site || !c.lanes.site.length) return false
            if (!('country' in ev)) Object.assign(ev, place())
            const payload = await seal(c.recipient.encrypt, JSON.stringify(ev))
            const L = c.lanes.site, start = Math.floor(Math.random() * L.length)   // a random first lane spreads the load
            for (const token of L.map((_, i) => L[(start + i) % L.length])) {
                const r = await fetch(`${c.endpoint}/api/vault/append/write/${c.vault_id}`, { method: 'POST', keepalive: true,
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ append_token: token, payload }) })
                if (r.status !== 507) return r.ok
            }
            return false
        }
        const resend = () => {                                            // reads an earlier page in this tab could not finish sending
            try {
                for (const k of Object.keys(sessionStorage).filter(k => k.startsWith('pt.obs.pending.'))) {
                    const ev = JSON.parse(sessionStorage.getItem(k)); sessionStorage.removeItem(k)
                    send(ev).catch(() => { })
                }
            } catch { }
        }
        // a yes or no on a page (assets/talk/talk.js, dev.places@PrompTugal.dinis, 15 Nov 2026): one more event on this
        // lane, with no identity: the same fields as a view, plus the vote; absent under Do Not Track or the pause
        window.PTObs = { vote: (v, path) => send(Object.assign(common(), { type: 'vote', vote: v > 0 ? 1 : -1 }, path ? { voted_on: String(path).slice(0, 200) } : {})).catch(() => false) }
        const view = () => { resend(); if (done.has('view')) return; done.add('view'); send(Object.assign(common(), { type: 'view' })).catch(() => { }) }
        const finish = () => {
            if (since !== null) { visibleMs += performance.now() - since; since = null }
            if (done.has('read')) return
            scrolled(); done.add('read')
            const ev = Object.assign(common(), { type: 'read', visible_s: Math.min(3600, Math.round(visibleMs / 1000)), scroll: maxScroll })
            const key = 'pending.' + ev.path + '.' + Date.now()
            SS.set(key, JSON.stringify(ev))                                   // kept until written: leaving can cut the send short
            send(ev).then(ok => { if (ok) SS.del(key) }).catch(() => { })
        }
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') since = performance.now(); else finish() })
        window.addEventListener('pagehide', finish)
        cfg().catch(() => { })
        if (document.readyState === 'complete') setTimeout(view, 0); else window.addEventListener('load', view)
    } catch { }
})()
