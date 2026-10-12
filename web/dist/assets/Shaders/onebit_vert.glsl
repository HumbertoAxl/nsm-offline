attribute vec4 Position;
attribute vec4 TexCoord;
attribute vec4 Normal;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying vec2 texcoord;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord = TexCoord.xy;
}
