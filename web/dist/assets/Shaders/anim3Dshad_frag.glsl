
Import:(precision.h)

//DEPTHTEST=ON
//DEPTHWRITE=ON
uniform sampler2D TexSamp0;
varying vec4 color;

void main(){
	gl_FragColor.xyz = texture2D(TexSamp0,color.zz).xyz;
	//gl_FragColor.y = 1.0-gl_FragColor.x;
	gl_FragColor.w = 1.0;
}
