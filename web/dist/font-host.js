// Android font boundary. Layout uses the metrics supplied in the APK.
export function fontCall(host,self,name,a){
  if(name==='<init>'||name==='Setup'){self.faces=[];self.glyphs=new Map();return 0;}
  if(name==='LoadFace'){
    const path=host.path(a[0]),bytes=host.files.get(path.replace(/\.ttf$/,'.metrics'));
    const face={path,sizes:[],kern:new Map(),charCount:208,max:1,minW:.1,minH:.1};
    if(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);face.charCount=v.getInt32(0,true);face.max=v.getFloat32(4,true);face.minW=v.getFloat32(8,true);face.minH=v.getFloat32(12,true);for(let p=16;p+12<=bytes.length;p+=12)face.kern.set(v.getInt32(p,true)+','+v.getInt32(p+4,true),v.getFloat32(p+8,true));}
    self.faces.push(face);return self.faces.length-1;
  }
  if(name==='AddSizeToFace'){const f=self.faces[a[0]];f.sizes.push({point:a[1],scale:a[2],offset:a[3],gradient:a[4],gradientY:a[5]});return f.sizes.length-1;}
  if(name==='ReadGlyphsDataFromFile'){
    const b=host.files.get(host.path(a[0]));if(!b)return 0;const v=new DataView(b.buffer,b.byteOffset,b.byteLength),count=v.getInt32(0);
    for(let j=0;j<count;j++){const p=4+16*j,face=v.getInt32(p),size=v.getInt32(p+4),start=v.getInt32(p+8),end=v.getInt32(p+12);for(let q=start;q+14<=end;q+=14)self.glyphs.set(face+','+size+','+v.getInt32(q),{width:v.getInt16(q+4),height:v.getInt16(q+6),bearingX:v.getInt16(q+8),bearingY:v.getInt16(q+10),advance:v.getInt16(q+12)});}
    return 0;
  }
  const metrics=(face,size,char)=>{const key=face+','+size+','+char;let m=self.glyphs.get(key);if(!m){const s=self.faces[face].sizes[size],ctx=host.options.fontContext;let width=s.point*.6,height=s.point*.8,advance=width;if(ctx){ctx.font=`${Math.trunc(s.point)}px '${fontFamily(self.faces[face].path)}'`;const t=ctx.measureText(String.fromCharCode(char));width=Math.ceil(t.actualBoundingBoxLeft+t.actualBoundingBoxRight);height=Math.ceil(t.actualBoundingBoxAscent+t.actualBoundingBoxDescent);advance=Math.trunc(t.width);}m={width,height,bearingX:0,bearingY:Math.ceil(s.point*.8),advance};self.glyphs.set(key,m);}return m;};
  if(name==='CalculateGlyphMetrics'){self.current=metrics(...a);return 0;}
  const keys={GetGlyphW:'width',GetGlyphH:'height',GetGlyphBearingX:'bearingX',GetGlyphBearingY:'bearingY',GetGlyphAdvance:'advance'};
  if(keys[name])return self.current?.[keys[name]]||0;
  if(name==='GetKerning')return Math.trunc(metrics(a[0],a[1],a[2]).width*(self.faces[a[0]].kern.get(a[2]+','+a[3])||0));
  if(name==='CalculateFontMaxSize'||name==='CalculateFontAdjustedSize'){
    const face=self.faces[a.at(-2)],size=face.sizes[a.at(-1)],all=[...self.glyphs.entries()].filter(([k])=>k.startsWith(a.at(-2)+','+a.at(-1)+','));
    self.fontMaxH=Math.ceil(size.point*1.22);self.fontMaxW=Math.trunc(face.max*self.fontMaxH);self.fontMinH=Math.trunc(face.minH*self.fontMaxH);self.fontMinW=Math.trunc(face.minW*self.fontMaxH);self.fontCharCount=face.charCount;return 0;
  }
  if(name.startsWith('GetFont'))return self[name.replace('GetFont','font')]||0;
  if(name==='DrawCharToBitmap'){
    const [face,size,char,surface,x,y,fx,fy]=a,s=self.faces[face].sizes[size],m=metrics(face,size,char);
    if(host.options.graphics)host.options.graphics.drawGlyph(surface,String.fromCharCode(char),Math.trunc(s.point),fontFamily(self.faces[face].path),x,y,m,s,fy);
    return 0;
  }
  if(name==='DrawBitmapToBitmap'){host.options.graphics?.copySurface(...a);return 0;}
  if(name==='IsDummy')return false;
  if(['CheckPendingDrawCharToBitmap','CheckPendingGlyphMetrics','Shutdown','PrintFontInfo','WriteMetricsFile'].includes(name))return 0;
}
export const fontFamily=path=>'NSMFont_'+path.split('/').pop().replace(/\.ttf$/,'');

