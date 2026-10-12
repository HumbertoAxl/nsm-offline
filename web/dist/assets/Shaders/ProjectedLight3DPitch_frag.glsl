//NAME(PL_VCOL_PITCHFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
uniform sampler2D TexSamp2;
varying mediump vec2 texcoord1;
varying mediump vec2 texcoord2;
varying mediump vec2 texcoord3;
uniform float tileScale;

//DEPTHTEST=ON
//DEPTHWRITE=ON
//CULLFACE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord1.xy*tileScale);
	gl_FragColor.xyz *= texture2D(TexSamp2,texcoord3).xyz;
	gl_FragColor.xyz *= texture2D(TexSamp1,texcoord2.xy).xyz;
}
