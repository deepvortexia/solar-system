import sshelp as H


def mercury(nt):
    base = H.noise_color(nt, [
        (0.00, '#1C1C1E'),
        (0.30, '#38383C'),
        (0.55, '#54545A'),
        (0.78, '#717178'),
        (1.00, '#8C8C92'),
    ], scale=11.0, detail=15.0, distortion=0.3)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 22.0
    cr = H.ramp(nt, [(0.0, 0.45), (0.25, 0.8), (0.6, 1.0)])
    nt.links.new(vor.outputs['Distance'], cr.inputs['Fac'])
    return H.mix_color(nt, 1.0, base, cr.outputs['Color'], blend='MULTIPLY')


def venus(nt):
    return H.noise_color(nt, [
        (0.00, '#C8860A'),
        (0.30, '#E3A818'),
        (0.55, '#F6C838'),
        (0.80, '#FFDF70'),
        (1.00, '#FFEEA8'),
    ], scale=3.5, detail=12.0, distortion=1.6)


def earth(nt):
    return H.noise_color(nt, [
        (0.00, '#04338F'),
        (0.45, '#0A52C4'),
        (0.50, '#1670E8'),
        (0.535, '#157A24'),
        (0.61, '#2D9C34'),
        (0.70, '#4F8F28'),
        (0.80, '#8A6A2C'),
        (1.00, '#6E4E24'),
    ], scale=1.7, detail=14.0, distortion=0.2)


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
    return H.noise_color(nt, [
        (0.00, '#561204'),
        (0.30, '#7E1E06'),
        (0.50, '#A52E0A'),
        (0.70, '#C23E10'),
        (0.88, '#D4521C'),
        (1.00, '#E0682C'),
    ], scale=3.2, detail=14.0, distortion=0.3)


H.retexture("Mercury", mercury, img_size=1024, roughness=0.95)
H.retexture("Venus", venus, img_size=1024, roughness=0.8)
H.retexture("Earth", earth, img_size=2048, roughness=0.7)
H.retexture("Moon", moon, img_size=1024, roughness=0.97)
H.retexture("Mars", mars, img_size=1024, roughness=0.95)
_result = "RETEX_INNER_DONE: Mercury/Venus/Mars/Moon 1024, Earth 2048"
