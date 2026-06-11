import sshelp as H


def mercury(nt):
    base = H.noise_color(nt, [
        (0.00, '#3E332A'),
        (0.30, '#6B5847'),
        (0.55, '#94795F'),
        (0.78, '#BC9D7E'),
        (1.00, '#DCC2A0'),
    ], scale=11.0, detail=15.0, distortion=0.3)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 22.0
    cr = H.ramp(nt, [(0.0, 0.45), (0.25, 0.8), (0.6, 1.0)])
    nt.links.new(vor.outputs['Distance'], cr.inputs['Fac'])
    return H.mix_color(nt, 1.0, base, cr.outputs['Color'], blend='MULTIPLY')


def venus(nt):
    return H.noise_color(nt, [
        (0.00, '#B8741F'),
        (0.30, '#D99A2B'),
        (0.55, '#F0BC4A'),
        (0.80, '#FCDF8E'),
        (1.00, '#FFF3C4'),
    ], scale=3.5, detail=12.0, distortion=1.6)


def earth(nt):
    oceans_land = H.noise_color(nt, [
        (0.00, '#03245F'),
        (0.45, '#0A3D91'),
        (0.50, '#1059C9'),
        (0.535, '#1F8A2E'),
        (0.61, '#3FA83C'),
        (0.70, '#7BA32F'),
        (0.80, '#C9A23C'),
        (1.00, '#D9B954'),
    ], scale=1.7, detail=14.0, distortion=0.2)
    return H.polar_caps(nt, oceans_land, '#F4FAFF', start=0.40, end=0.46)


def moon(nt):
    base = H.noise_color(nt, [
        (0.00, '#4A4A42'),
        (0.35, '#73736A'),
        (0.65, '#9C9C92'),
        (1.00, '#C8C8BE'),
    ], scale=7.0, detail=13.0)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 16.0
    cr = H.ramp(nt, [(0.0, 0.4), (0.3, 0.75), (0.7, 1.0)])
    nt.links.new(vor.outputs['Distance'], cr.inputs['Fac'])
    return H.mix_color(nt, 1.0, base, cr.outputs['Color'], blend='MULTIPLY')


def mars(nt):
    base = H.noise_color(nt, [
        (0.00, '#7A220A'),
        (0.30, '#A93310'),
        (0.50, '#D2491A'),
        (0.70, '#E8642E'),
        (0.88, '#F58B4C'),
        (1.00, '#FCAE74'),
    ], scale=3.2, detail=14.0, distortion=0.3)
    return H.polar_caps(nt, base, '#F2EBE0', start=0.43, end=0.475)


H.retexture("Mercury", mercury, img_size=1024, roughness=0.95)
H.retexture("Venus", venus, img_size=1024, roughness=0.8)
H.retexture("Earth", earth, img_size=2048, roughness=0.7)
H.retexture("Moon", moon, img_size=1024, roughness=0.97)
H.retexture("Mars", mars, img_size=1024, roughness=0.95)
_result = "RETEX_INNER_DONE: Mercury/Venus/Mars/Moon 1024, Earth 2048"
