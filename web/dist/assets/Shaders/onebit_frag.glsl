
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texcoord;

//DEPTHTEST=ON
//DEPTHWRITE=ON
//CULLFACE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy);
	if (gl_FragColor.w<0.5) discard;
}
