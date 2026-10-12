//NAME(DOWNSAMPLEFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
varying vec2 texCoord;

//DEPTHTEST=ON
//DEPTHWRITE=ON

vec4 Sample(float x, float y){
	return texture2D(TexSamp0,texCoord.xy+vec2(x*0.0024+0.0019,y*0.0012+0.0009));
}

void main(){
	gl_FragColor = (Sample(0.0,0.0)*0.2)+(Sample(1.0,0.0)+Sample(0.0,1.0)+Sample(-1.0,0.0)+Sample(0.0,-1.0))*(0.5/4.0)+ (Sample(1.0,1.0)+Sample(1.0,-1.0)+Sample(-1.0,1.0)+Sample(-1.0,-1.0))*(0.3/4.0);

	//gl_FragColor.xy=texcoord.xy;
}
