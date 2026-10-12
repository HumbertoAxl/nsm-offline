//NAME(TITLEBALLFRAG)
Import:(precision.h)

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying vec2 texcoord;
//varying vec4 vcolor;
varying vec4 norm;
varying vec4 pos;

uniform vec4 UVTrans1;
uniform vec4 SpecParams;

//DEPTHTEST=ON
//DEPTHWRITE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord.xy);
	vec3 n = normalize(norm.xyz);

	gl_FragColor*= (vec4(1,1,1,1)*clamp(1.1-(n.z+n.y*0.5),0.2,0.9))+(vec4(0.1,0.5,0,0)*clamp(n.z*0.3,0.1,0.2));
//	gl_FragColor*= (vec4(1,1,1,1)*clamp(0.5-(n.z-n.y*0.5),0.2,0.9))+(vec4(0.1,0.5,0,0)*clamp(n.z*0.3,0.1,0.2));
	float ssao=clamp((pos.z-50.0)/25.0,0.0,0.5);
	gl_FragColor.xyz-=vec3(1.0,1.0,1.0)*ssao*ssao*ssao;
	vec3 ref = normalize(pos.xyz - (n*2.0*dot(n,pos.xyz)));
	float spec = clamp(-ref.z,0.0,1.0);
	spec*=spec*spec;
	gl_FragColor+=spec*spec;

}
