//NAME(PIXEL)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texCoord;
varying vec4 vcolor;

//DEPTHTEST=ON

void main(){
	gl_FragColor.xyzw=texture2D( TexSamp0,texCoord ).xyzw*vcolor.rgba;
}
