import bpy
import sshelp as H

# Earth-like blue/green head, baked to an image so it survives glTF export.

def earthcol(nt):
    base = H.noise_color(nt, [
        (0.00, '#0A2E5C'),   # deep ocean
        (0.45, '#11528F'),   # ocean
        (0.50, '#1E6FB0'),   # shallow sea
        (0.535, '#2E7D3A'),  # coast / green land
        (0.66, '#5FA046'),   # green land
        (0.80, '#C6B074'),   # arid land
        (1.00, '#E3D49E'),   # desert highlights
    ], scale=2.2, detail=10.0)
    return H.polar_caps(nt, base, '#F2F7FA', start=0.40, end=0.46)

head = H.build_planet("MascotHead", 1.0, 0.0, earthcol,
                      img_size=512, roughness=0.55)
head.location = (0.0, 0.0, 2.6)

_result = f"Head built + textured at {tuple(round(v,2) for v in head.location)}"
