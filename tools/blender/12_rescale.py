import bpy

# 2.5x planet scale; orbits spread so enlarged planets (and Saturn's rings,
# and the Moon's orbit) no longer overlap
changes = {
    "Mercury": 11.0,
    "Venus": 15.0,
    "Earth": 24.0,
    "Mars": 33.0,
    "Jupiter": 46.0,
    "Saturn": 72.0,
    "Uranus": 95.0,
    "Neptune": 110.0,
}
for name, x in changes.items():
    o = bpy.data.objects[name]
    o.scale = (2.5, 2.5, 2.5)
    o.location.x = x

# Moon (child of Earth) and SaturnRings (child of Saturn) follow automatically
moon_w = bpy.data.objects["Moon"].matrix_world.translation
_result = f"Rescaled 8 planets 2.5x, orbits spread to x={list(changes.values())}; Moon now at {tuple(round(v, 2) for v in moon_w)}"
