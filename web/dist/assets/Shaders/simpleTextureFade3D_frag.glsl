
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
uniform float FadeScale;
varying vec2 texcoord;

//DEPTHTEST=ON
//DEPTHWRITE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy);
	gl_FragColor *= texture2D(TexSamp1,texcoord.xy/FadeScale).w;
}
