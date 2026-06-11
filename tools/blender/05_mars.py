import sshelp as H


def col(nt):
    base = H.noise_color(nt, [
        (0.00, '#6E3318'),
        (0.35, '#9C4A24'),
        (0.55, '#B5552D'),
        (0.75, '#C97947'),
        (1.00, '#D98E5C'),
    ], scale=2.8, detail=9.0)
    return H.polar_caps(nt, base, '#E8DDD0', start=0.43, end=0.475)


obj = H.build_planet("Mars", 0.53, 20.0, col, img_size=512, roughness=0.95,
                     tilt=25.2)
_result = "Mars created (r=0.53 at x=20, tilt 25.2)"
