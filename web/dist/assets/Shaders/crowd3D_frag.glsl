//NAME(SIMPLE3DFRAG)
Import:(precision.h)
uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;


//DEPTHTEST=ON
//DEPTHWRITE=ON

varying mediump vec4 norm;
varying vec2 texcoord;
varying vec2 texcoord2;

void main(){

	gl_FragColor = texture2D(TexSamp0,texcoord.xy);
}
