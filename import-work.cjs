const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const categories = [
 ['new Ac under ground Fitting','underground-fitting','Underground AC fitting'],
 ['New Ahu fcu condensing installation','ahu-fcu-ac','AHU, FCU & condensing unit installation'],
 ['New Air drier repairing','air-drier','Air drier repairing'],
 ['New cassette ac installation','cassette-ac','Cassette AC installation'],
 ['new chiller repairing','chiller-ac','Chiller repairing'],
 ['new cold unit installation repairing','cold-unit-ac','Cold unit installation & repairing'],
 ['new Ductable ac installation , repairing','ductable-ac','Ductable AC repairing & installation'],
 ['new package ac repairing','package-ac','Package AC repairing'],
 ['NEW service Ductble tower split ac','ac-servicing','Ductable, tower & split AC servicing'],
 ['new split AC installation photo','split-ac','Split AC installation'],
 ['new tower ac install','tower-ac','Tower AC installation'],
 ['New vrv','vrv-ac','VRV'],
];
async function walk(dir) {
 const entries = await fs.readdir(dir,{withFileTypes:true});
 const files = [];
 for (const entry of entries) {
  const full = path.join(dir,entry.name);
  if(entry.isDirectory()) files.push(...await walk(full)); else files.push(full);
 }
 return files.sort();
}
(async()=>{
 const catalogPath = path.join(__dirname, 'src/data/catalog.json');
 const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
 const manifest = {};
 for(const [folder,slug,name] of categories) {
  const files = await walk(path.join(process.env.MEDIA_SOURCE_DIR ?? 'E:/',folder));
  const photos = files.filter(f=>/\.(jpe?g|png|webp)$/i.test(f));
  const out = path.join(__dirname,'public','work',slug);
  await fs.mkdir(out,{recursive:true});
  const gallery = [];
  for(const [i,file] of photos.entries()) {
   const filename = `photo-${String(i+1).padStart(3,'0')}.webp`;
   await sharp(file).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(path.join(out,filename));
   gallery.push(`/work/${slug}/${filename}`);
  }
  const videos = [];
  if(!photos.length) for(const [i,file] of files.filter(f=>/\.mp4$/i.test(f)).entries()) {
   const filename = `video-${i+1}.mp4`;
   await fs.copyFile(file,path.join(out,filename));
   videos.push(`/work/${slug}/${filename}`);
  }
  manifest[slug] = {name: folder.replace(/^new\s+/i, '').replace(/\b[a-z]+\b/gi, word => /^(ac|ahu|fcu|vrv)$/i.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()),gallery,videos};
  console.log(`${name}: ${gallery.length} photos, ${videos.length} videos`);
 }
 catalog.services = catalog.services.map(service => {
  const work = manifest[service.slug];
  return work ? {...service, ...work, image: work.gallery[0] ?? service.image} : service;
 });
 const shopDir = path.join(process.env.MEDIA_SOURCE_DIR ?? 'E:/', 'shop');
 const shopImage = (await walk(shopDir)).find(file => /\.(jpe?g|png|webp)$/i.test(file));
 if (shopImage) {
  const shopOut = path.join(__dirname, 'public/work/shop');
  await fs.mkdir(shopOut, {recursive:true});
  await sharp(shopImage).rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(path.join(shopOut,'shop.webp'));
 }
 await fs.writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
