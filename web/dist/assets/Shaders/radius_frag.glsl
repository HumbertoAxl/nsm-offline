//NAME(RADIUSFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texcoord;
varying vec4 pos;
uniform vec4 radius;
varying vec4 color;

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy)*color;

	vec2 relpos = pos.xy-radius.xy;
	float dist = radius.z-dot(relpos,relpos);
	dist = clamp(dist*radius.w,0.0,1.0);
	gl_FragColor.w *= dist;
	gl_FragColor.rgb*=dist;
}
