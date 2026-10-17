import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage(); await p.goto('http://127.0.0.1:8088/', { waitUntil: 'networkidle2' });
await p.evaluate(async () => fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'paynes.admin', password: 'Paynes-demo-2026' }) }));
await p.goto('http://127.0.0.1:8088/#/my-users', { waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, 2000));
console.log(await p.evaluate(() => JSON.stringify({ u: state.user && state.user.client_admin, t: document.querySelector('#main').innerText.slice(0, 200) })));
await b.close();
