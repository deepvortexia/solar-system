import sshelp as H


def jupiter(nt):
    bands = H.band_color(nt, [
        (0.00, '#D9A05B'),
        (0.10, '#A85F2E'),
        (0.18, '#F5E7C8'),
        (0.26, '#C75B22'),
        (0.34, '#FFF2D9'),
        (0.43, '#D6A65A'),
        (0.50, '#EEDDB5'),
        (0.58, '#9C5A28'),
        (0.66, '#F3E5C0'),
        (0.76, '#CE9244'),
        (0.87, '#E8CF9E'),
        (1.00, '#C99A52'),
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
    return H.mix_color(nt, mr.outputs['Result'], bands, '#D43D1A')


def saturn(nt):
    return H.band_color(nt, [
        (0.00, '#C9A35C'),
        (0.14, '#E0BC72'),
        (0.28, '#F5DCA0'),
        (0.42, '#E6C684'),
        (0.55, '#FAE7B4'),
        (0.70, '#D9B069'),
        (0.85, '#F0D699'),
        (1.00, '#CBA260'),
    ], noise_scale=5.0, distort=0.035, detail=7.0)


def uranus(nt):
    return H.band_color(nt, [
        (0.00, '#2FA8B8'),
        (0.35, '#4CC4D0'),
        (0.65, '#72DCE4'),
        (1.00, '#9FF0F4'),
    ], noise_scale=3.5, distort=0.025, detail=5.0)


def neptune(nt):
    return H.band_color(nt, [
        (0.00, '#0F2DA8'),
        (0.28, '#1A47DE'),
        (0.46, '#2E63F0'),
        (0.60, '#1336BC'),
        (0.78, '#4D82F5'),
        (1.00, '#6FA0FF'),
    ], noise_scale=4.5, distort=0.06, detail=8.0)


H.retexture("Jupiter", jupiter, img_size=2048, roughness=0.65)
H.retexture("Saturn", saturn, img_size=2048, roughness=0.65)
H.retexture("Uranus", uranus, img_size=1024, roughness=0.6)
H.retexture("Neptune", neptune, img_size=1024, roughness=0.6)
_result = "RETEX_OUTER_DONE: Jupiter/Saturn 2048, Uranus/Neptune 1024"
