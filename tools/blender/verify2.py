import bpy
bpy.context.view_layer.update()
out = []
for name in ("Sun", "Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "SaturnRings", "Uranus", "Neptune"):
    o = bpy.data.objects[name]
    w = o.matrix_world
    loc = tuple(round(v, 2) for v in w.translation)
    scl = round(w.to_scale()[0], 2)
    out.append(f"{name}: pos={loc} scale={scl}")
_result = " | ".join(out)
