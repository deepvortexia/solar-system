import bpy
import sshelp as H


def col(nt):
    oceans_land = H.noise_color(nt, [
        (0.00, '#06244E'),
        (0.46, '#0B3C77'),
        (0.50, '#0E4C8A'),
        (0.535, '#2F6B33'),
        (0.62, '#557C3A'),
        (0.74, '#8A7B4C'),
        (1.00, '#A89767'),
    ], scale=1.7, detail=10.0)
    return H.polar_caps(nt, oceans_land, '#EAF2F5', start=0.40, end=0.46)


earth = H.build_planet("Earth", 1.0, 16.0, col, img_size=1024, roughness=0.7,
                       tilt=23.4)


def mooncol(nt):
    base = H.noise_color(nt, [
        (0.00, '#5C5C55'),
        (0.40, '#7D7D74'),
        (0.70, '#9B9B93'),
        (1.00, '#B5B5AD'),
    ], scale=6.0, detail=9.0)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 12.0
    cr = H.ramp(nt, [(0.0, 0.5), (0.3, 0.8), (0.7, 1.0)])
    nt.links.new(vor.outputs['Distance'], cr.inputs['Fac'])
    return H.mix_color(nt, 1.0, base, cr.outputs['Color'], blend='MULTIPLY')


moon = H.build_planet("Moon", 0.27, 18.2, mooncol, img_size=512, roughness=0.97)
moon.location = (18.2, 0.0, 0.45)
moon.parent = earth
moon.matrix_parent_inverse = earth.matrix_world.inverted()

_result = "Earth (r=1.0 at x=16, tilt 23.4) + Moon (r=0.27, parented to Earth)"
