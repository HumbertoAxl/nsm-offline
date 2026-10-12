//NAME(PL_VCOL_ONEBITFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying mediump vec2 texcoord1;
varying mediump vec2 texcoord2;
varying lowp vec4 color;


//DEPTHTEST=ON
//DEPTHWRITE=ON
//CULLFACE=OFF

void main(){
	gl_FragColor = texture2D(TexSamp0,texcoord1.xy)*(color*texture2D(TexSamp1,texcoord2.xy));
	if ((gl_FragColor.w<0.5) && (dot(color.xyz,vec3(1,1,1))>0.0)) {
		discard;
	}
}
