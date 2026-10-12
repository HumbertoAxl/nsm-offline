Import:(precision.h)
attribute vec4 Position;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying mediump vec2 texcoord;

uniform vec4 UVTrans0;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord = UVTrans0.xy;
}
