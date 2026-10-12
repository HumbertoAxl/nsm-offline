//NAME(VERTEXLITFADEDFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END


uniform sampler2D TexSamp0;
varying vec2 texcoord;
varying vec4 vcolor;

uniform float Fade;

//DEPTHTEST=ON
//DEPTHWRITE=ON

void main()
{
	gl_FragColor.xyzw=texture2D( TexSamp0,texcoord ).xyzw*vcolor.rgba * Fade;

}