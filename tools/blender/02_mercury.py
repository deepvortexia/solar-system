import sshelp as H


def col(nt):
    base = H.noise_color(nt, [
        (0.00, '#4A443F'),
        (0.35, '#6E6660'),
        (0.60, '#8C837B'),
        (0.85, '#A59A90'),
        (1.00, '#B8AEA3'),
    ], scale=9.0, detail=10.0)
    # crater mottling
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 16.0
    cr = H.ramp(nt, [(0.0, 0.55), (0.25, 0.85), (0.6, 1.0)])
    nt.links.new(vor.outputs['Distance'], cr.inputs['Fac'])
    return H.mix_color(nt, 1.0, base, cr.outputs['Color'], blend='MULTIPLY')


obj = H.build_planet("Mercury", 0.38, 9.0, col, img_size=512, roughness=0.95)
_result = "Mercury created (r=0.38 at x=9)"
