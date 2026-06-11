import sshelp as H


def jupiter(nt):
    bands = H.band_color(nt, [
        (0.00, '#DE8C30'),
        (0.10, '#8A4412'),
        (0.18, '#F4CE8E'),
        (0.26, '#C2490C'),
        (0.34, '#F8DCA0'),
        (0.43, '#E08A2A'),
        (0.50, '#EFC476'),
        (0.58, '#76390E'),
        (0.66, '#F2C780'),
        (0.76, '#CB741A'),
        (0.87, '#E2AC54'),
        (1.00, '#B96E1E'),
    ], noise_scale=6.0, distort=0.05, detail=9.0)
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
    return H.mix_color(nt, mr.outputs['Result'], bands, '#E03210')


def saturn(nt):
    return H.band_color(nt, [
        (0.00, '#C08A30'),
        (0.14, '#D8A748'),
        (0.28, '#F0C868'),
        (0.42, '#E2B14E'),
        (0.55, '#F8D87E'),
        (0.70, '#D0973A'),
        (0.85, '#ECC05C'),
        (1.00, '#C28C32'),
    ], noise_scale=5.0, distort=0.035, detail=7.0)


def uranus(nt):
    return H.band_color(nt, [
        (0.00, '#18C0D8'),
        (0.35, '#3EDCEC'),
        (0.65, '#6CEEF6'),
        (1.00, '#A4FAFF'),
    ], noise_scale=3.5, distort=0.025, detail=5.0)


def neptune(nt):
    return H.band_color(nt, [
        (0.00, '#081A78'),
        (0.28, '#0E2EAE'),
        (0.46, '#1A44D2'),
        (0.60, '#0A2188'),
        (0.78, '#2C56DC'),
        (1.00, '#4472EA'),
    ], noise_scale=4.5, distort=0.06, detail=8.0)


H.retexture("Jupiter", jupiter, img_size=2048, roughness=0.65)
H.retexture("Saturn", saturn, img_size=2048, roughness=0.65)
H.retexture("Uranus", uranus, img_size=1024, roughness=0.6)
H.retexture("Neptune", neptune, img_size=1024, roughness=0.6)
_result = "RETEX_OUTER_DONE: Jupiter/Saturn 2048, Uranus/Neptune 1024"
