
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying vec2 texcoord;
uniform vec4 blendcontrol;

//DEPTHTEST=ON
//DEPTHWRITE=ON

void main(){
	gl_FragColor = mix(texture2D(TexSamp0,texcoord.xy),texture2D(TexSamp1,texcoord.xy),blendcontrol.x);
	//gl_FragColor.xy=texcoord.xy;
}
