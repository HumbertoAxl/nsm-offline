//NAME(SEGMENTFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texcoord;
varying vec4 pos;
uniform vec4 seganim;
varying vec4 color;

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy)*color;

	vec2 relpos = pos.xy-seganim.xy;
	float ang = atan(relpos.x,relpos.y)/3.1415;
	ang = clamp((ang-seganim.z)*seganim.w,0.0,1.0);
	gl_FragColor.w *= ang;
	gl_FragColor.rgb*=ang;
}
