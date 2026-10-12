//NAME(ANIM3DFRAG)
Import:(precision.h)

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying vec2 texcoord;
//varying vec4 vcolor;
varying vec4 norm;
//varying vec4 pos;

uniform vec4 UVTrans1;
uniform vec4 SpecParams;

//DEPTHTEST=ON
//DEPTHWRITE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy);
	vec3 n = normalize(norm.xyz);
	float bright = max(-0.2,dot(n,vec3(-0.2,-0.2,-0.9)));
	gl_FragColor.xyz *= bright+SpecParams.x;
}
