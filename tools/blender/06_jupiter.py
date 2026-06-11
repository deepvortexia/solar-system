import sshelp as H


def col(nt):
    bands = H.band_color(nt, [
        (0.00, '#C7A26B'),
        (0.12, '#A8784E'),
        (0.20, '#E3D3B0'),
        (0.28, '#B5743F'),
        (0.36, '#E8DCC0'),
        (0.45, '#C49C68'),
        (0.52, '#DCC9A2'),
        (0.60, '#A67C52'),
        (0.68, '#E3D5B4'),
        (0.78, '#BD9663'),
        (0.88, '#D8C39A'),
        (1.00, '#C2A171'),
    ], noise_scale=5.0, distort=0.045, detail=6.0)

    # Great Red Spot: distance mask in generated coords, squashed in Z
    tc = H.tex_coord(nt)
    vm = nt.nodes.new('ShaderNodeVectorMath')
    vm.operation = 'MULTIPLY'
    nt.links.new(tc.outputs['Generated'], vm.inputs[0])
    vm.inputs[1].default_value = (1.0, 1.0, 1.9)
    vd = nt.nodes.new('ShaderNodeVectorMath')
    vd.operation = 'DISTANCE'
    nt.links.new(vm.outputs['Vector'], vd.inputs[0])
    vd.inputs[1].default_value = (0.88, 0.5, 0.665)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = 0.05
    mr.inputs['From Max'].default_value = 0.11
    mr.inputs['To Min'].default_value = 1.0
    mr.inputs['To Max'].default_value = 0.0
    nt.links.new(vd.outputs['Value'], mr.inputs['Value'])
    return H.mix_color(nt, mr.outputs['Result'], bands, '#B14A32')


obj = H.build_planet("Jupiter", 3.2, 27.0, col, img_size=1024, roughness=0.65,
                     tilt=3.1, seg=96, rings=48)
_result = "Jupiter created (r=3.2 at x=27, bands + Great Red Spot)"
