//NAME(REGIONFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texcoord;
varying vec4 pos;
uniform vec4 region;
varying vec4 color;

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy)*color;

	vec2 relpos = pos.xy-region.xy;
	float dtl = min(relpos.x,relpos.y);
	float dbr = min(region.z-relpos.x,region.w-relpos.y);
	float dist = clamp(min(dtl,dbr),0.0,1.0);
	gl_FragColor.w *= dist;
	gl_FragColor.rgb*=dist;
}
