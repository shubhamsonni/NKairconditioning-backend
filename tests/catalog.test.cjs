const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { catalogRouter } = require('../dist/catalog.js');
let server, base;
before(async () => {
  const app = express();
  app.use('/api/catalog', catalogRouter);
  app.use('/work', express.static(path.resolve(__dirname, '../public/work')));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const get = url => fetch(base + url);

test('category summaries contain exactly 12 folders without full media lists', async () => {
  const { services } = await (await get('/api/catalog/services')).json();
  assert.equal(services.length, 12);
  for (const service of services) {
    assert.ok(!('gallery' in service));
    assert.ok(!('videos' in service));
    assert.ok(service.mediaCount > 0);
    assert.ok(!/^new\s/i.test(service.name));
  }
});

test('all gallery pages return at most ten items without overlap or omissions', async () => {
  const { services } = await (await get('/api/catalog/services')).json();
  for (const service of services) {
    const seen = new Set();
    for (let page = 1; page <= Math.ceil(service.mediaCount / 10); page++) {
      const response = await get(`/api/catalog/services/${service.slug}/media?page=${page}`);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.page, page);
      assert.equal(result.total, service.mediaCount);
      assert.equal(result.items.length, Math.min(10, service.mediaCount - (page - 1) * 10));
      for (const item of result.items) {
        assert.ok(!seen.has(item.src));
        seen.add(item.src);
        assert.ok(require('node:fs').existsSync(path.resolve(__dirname, '../public' + item.src)));
      }
    }
    assert.equal(seen.size, service.mediaCount);
  }
});

test('pagination rejects malformed, duplicate and out-of-range pages', async () => {
  for (const page of ['0', '-1', '1.5', 'abc', '9007199254740992', '1&page=2']) {
    assert.equal((await get(`/api/catalog/services/split-ac/media?page=${page}`)).status, 400);
  }
  assert.equal((await get('/api/catalog/services/split-ac/media?page=999')).status, 404);
  assert.equal((await get('/api/catalog/services/missing/media')).status, 404);
  assert.equal((await get('/api/catalog/services/missing')).status, 404);
});

test('hero keeps shop first, seven slides and three distinct random categories', async () => {
  const variants = new Set();
  for (let i = 0; i < 5; i++) {
    const response = await get('/api/catalog/hero');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { slides } = await response.json();
    assert.equal(slides.length, 7);
    assert.equal(slides[0].image, '/work/shop/shop.webp');
    assert.equal(new Set(slides.slice(4).map(slide => slide.image.split('/')[2])).size, 3);
    variants.add(JSON.stringify(slides.slice(4)));
  }
  assert.ok(variants.size > 1);
});

test('video delivery supports range requests for seeking without full downloads', async () => {
  const response = await fetch(base + '/work/ac-servicing/video-1.mp4', { headers: { Range: 'bytes=0-99' } });
  assert.equal(response.status, 206);
  assert.match(response.headers.get('content-range'), /^bytes 0-99\//);
  assert.equal((await response.arrayBuffer()).byteLength, 100);
});
