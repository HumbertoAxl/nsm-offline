
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
}
