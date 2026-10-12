//NAME(COLOURED3DFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texcoord;
uniform vec4 colourmod;

//DEPTHTEST=ON
//DEPTHWRITE=OFF

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy)*colourmod;
	//gl_FragColor.xy=texcoord.xy;
}
