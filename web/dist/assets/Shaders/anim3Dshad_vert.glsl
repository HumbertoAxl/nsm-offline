
attribute vec4 Position;
attribute vec4 Normal;
attribute vec4 Position2;
attribute vec4 Normal2;
uniform mat4 MVPMatrix;
uniform vec4 Unpack_Scale;
uniform vec4 Unpack_Offset;
uniform vec4 Unpack_Scale2;
uniform vec4 Unpack_Offset2;
uniform vec4 Unpack_Weights;
varying vec4 color;

uniform vec4 shadowcol;

void main(){
	vec4 pos;
	pos = (Position *Unpack_Scale)+(Position2 * Unpack_Scale2) + Unpack_Offset;
	vec3 n = (Normal.xyz*Unpack_Weights.xyy)+(Normal2.xyz*Unpack_Weights.zww);

	float lol = pos.z*(-0.15);
	pos.xy+=n.xy*lol;
	pos.xy -= shadowcol.xy*pos.z;
	gl_Position=MVPMatrix*pos;
	color = pos*(-0.0017);
}
