
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END


uniform sampler2D TexSamp0;
varying vec2 texcoord;
varying vec4 vcolor;

//DEPTHTEST=ON
//DEPTHWRITE=ON
//CULLFACE=ON

void main()
{
	vec4 fragcolor = texture2D( TexSamp0,texcoord ).xyzw*vcolor.rgba;
	if (fragcolor.a < 0.4)
		discard;

	gl_FragColor.xyzw=texture2D( TexSamp0,texcoord ).xyzw*vcolor.rgba;
}