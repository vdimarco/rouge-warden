"""Compose seven pinned cast requests without network, uploads or provider submission."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'd33f5a4e8b2a7b096ebb8bf6a584394416df77d9'
ENDPOINT = 'meshy/v7.1/image-to-3d'
# Each immutable review also pins its reference image and exact original edit prompt.
CAST = {
    'GreenCap51': (3, '8ac31eb3d9ccf23e0e55cf9efa9be2943a7b6df0a96380e50251ef4b81bf7d93'),
    'Memphis33': (4, '3419b2477e20e2e09b7cdfb17142239b619d8e4ab391f4a26e161f4f4d40684b'),
    'BlackCap': (5, 'd9176a9966b90215568cba34e6e80d60905fc50afb3869faef92c5249fde6c83'),
    'WhiteCap': (6, 'f13e7bcd90e07bf60de79c6a3bbe23f3e742e24dbd62e8b777cb8a99597a0ca6'),
    'RedJersey': (7, '30fa7a9edd67cd96c4ecb09bd22da56602df61ab4ba4d82ae359c31c4be9c75a'),
    'LimeJacket': (8, '031c0c77448420f8983e59fef7e8c6400a06b3b44e69bbd3c96ef54a2fa58779'),
    'Topknot': (10, '33955a1524945fbedbc1b605bcb9da31f188977764d6265ced243df5c5a5f8b2'),
}
TEMPLATE = 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/request.json'
TEMPLATE_SHA = '47209121445fc43283c50481d7fc6adece8274fdf049ddec31e52c58f4a352d1'
STYLE = 'higgsfield/styles/nord.json'
STYLE_SHA = '06aeff519d85e425dfd4c2e1cfaae1891659155599e939aa36d9584bac34c943'
SCHEMA = 'Verification/TripoCast/Provider/input-schema.json'
SCHEMA_SHA = '3862d19ba32c9de1b96024c703c2966ea67b84a77e72dbb51afbae9b044cca9c'
SETTINGS = {
    'model_type': 'standard', 'topology': 'triangle', 'target_polycount': 100000,
    'symmetry_mode': 'auto', 'should_remesh': True, 'should_texture': True,
    'enable_pbr': True, 'pose_mode': 'a-pose', 'enable_rigging': True,
    'rigging_height_meters': 1.82, 'enable_animation': True,
    'animation_action_id': 0, 'enable_safety_checker': True, 'geometry_resolution': '4k',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def pinned(path, expected):
    require(path.is_file() and not path.is_symlink(), 'Missing/nonregular source: ' + str(path))
    raw = path.read_bytes()
    require(sha256(raw).hexdigest() == expected, 'Changed pinned source: ' + str(path))
    return raw


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def validate_input(values, schema):
    require(set(schema['required']) <= set(values) <= set(schema['properties']), 'Unexpected input fields')
    types = {'string': (str,), 'boolean': (bool,), 'integer': (int,),
             'number': (int, float), 'null': (type(None),)}
    for name, value in values.items():
        definition = schema['properties'][name]
        matched = False
        for rule in definition.get('anyOf', [definition]):
            if type(value) not in types[rule['type']]:
                continue
            if 'enum' in rule and value not in rule['enum']:
                continue
            if any(key in rule and not comparison(value, rule[key]) for key, comparison in (
                    ('minimum', lambda a, b: a >= b), ('maximum', lambda a, b: a <= b),
                    ('exclusiveMinimum', lambda a, b: a > b),
                    ('maxLength', lambda a, b: len(a) <= b))):
                continue
            matched = True
        require(matched, 'Input violates pinned provider schema: ' + name)
    require(0 <= values['animation_action_id'] <= 696, 'Animation preset outside documented range')


def source_plan(root=ROOT):
    root = root.resolve()
    repo = root.parents[1]
    template = json.loads(pinned(root / TEMPLATE, TEMPLATE_SHA))
    require(template['endpoint_id'] == ENDPOINT, 'Unexpected pilot endpoint')
    settings = {key: value for key, value in template['recipe']['input'].items()
                if key not in ('image_url', 'texture_prompt')}
    require(settings == SETTINGS, 'Pilot settings do not match the bounded cast recipe')
    pinned(repo / STYLE, STYLE_SHA)
    schema = json.loads(pinned(root / SCHEMA, SCHEMA_SHA))
    requests, characters = {}, []
    for name, (style, review_sha) in CAST.items():
        folder = root / 'Data/GraphicNovel/Crew' / name
        review = json.loads(pinned(folder / 'source-review.json', review_sha))
        reference_path = f'games/nord-unreal/Data/GraphicNovel/Crew/{name}/reference.png'
        prompt_path = f'games/nord-unreal/Data/GraphicNovel/Crew/{name}/prompt.txt'
        require(review['character'] == name, 'Wrong character review')
        require(review['clean_reference']['path'] == reference_path, 'Unexpected reference path')
        require(review['prompt']['path'] == prompt_path, 'Unexpected edit-prompt path')
        require(review['acceptance']['suitable_for_bounded_model_draft'] is True,
                'Reference is not reviewed for a bounded draft')
        image = pinned(folder / 'reference.png', review['clean_reference']['sha256'])
        require(image[:8] == b'\x89PNG\r\n\x1a\n', 'Reference is not a PNG')
        require(list(struct.unpack_from('>II', image, 16)) == review['clean_reference']['dimensions'],
                'Reference dimensions do not match its review')
        pinned(folder / 'prompt.txt', review['prompt']['sha256'])
        checks = review['checks']
        prompt = ("Preserve the reference adult's face, natural anatomy, palette, markings and accessories. "
                  f"{checks['identity']} {checks['outfit']} "
                  'Restrained dimensional hand-painted graphic-novel PBR surfaces. '
                  'No added text, symbols, baked outlines, halftone or harsh lighting.')
        require(0 < len(prompt) <= 600, 'Texture prompt exceeds the schema limit: ' + name)
        url = f'https://raw.githubusercontent.com/vdimarco/rouge-warden/{COMMIT}/{reference_path}'
        request = {'endpoint_id': ENDPOINT, 'input': dict(settings, image_url=url, texture_prompt=prompt)}
        validate_input(request['input'], schema)
        require(len(image) <= schema['properties']['image_url']['max_file_size'], 'Reference exceeds upload limit')
        width, height = review['clean_reference']['dimensions']
        require(width * height <= schema['properties']['image_url']['max_pixels'], 'Reference exceeds pixel limit')
        filename = name + '.json'
        requests[filename] = encoded(request)
        characters.append({
            'character': name, 'style': style, 'request_file': filename,
            'request_sha256': sha256(requests[filename]).hexdigest(),
            'reference': dict(review['clean_reference'], url=url),
            'review': {'path': str((folder / 'source-review.json').relative_to(repo)), 'sha256': review_sha},
            'edit_prompt': review['prompt'], 'texture_prompt_characters': len(prompt),
            'identity_constraints': {'identity': checks['identity'], 'outfit': checks['outfit'],
                'mature_adult_proportions': checks['mature_adult_proportions_retained'],
                'preserve_reference_palette_markings_accessories': True, 'new_wardrobe': False},
            'remaining_model_risks': review['remaining_3d_risks'],
        })
    require(len(characters) == 7 and {c['style'] for c in characters} == {3, 4, 5, 6, 7, 8, 10},
            'Incomplete or duplicate cast styles')
    report = {'status': 'dry_run_not_submitted', 'endpoint_id': ENDPOINT,
        'reference_url_commit': COMMIT, 'character_count': len(characters),
        'pilot_template': {'path': 'games/nord-unreal/' + TEMPLATE, 'sha256': TEMPLATE_SHA},
        'style_kit': {'path': STYLE, 'sha256': STYLE_SHA}, 'settings': settings,
        'provider_schema': {'path': 'games/nord-unreal/' + SCHEMA, 'sha256': SCHEMA_SHA},
        'provider_schema_snapshot_validated': True,
        'geometry_resolution_note': '4k geometry resolution; does not establish 4k texture resolution.',
        'target_polycount_note': '100000 is a requested target, not proof of returned topology or triangle count.',
        'face_animation_promised': False,
        'network_requests': 0, 'provider_jobs_submitted': 0, 'spent_usd': 0,
        'public_reference_http_hashes_verified': False,
        'live_schema_verified_by_this_planner': False,
        'characters': characters,
        'limits': ['Root must separately verify public URL bytes and current endpoint schema before submission.',
                   'Reference review does not establish generated anatomy, topology, fingers or native acceptance.',
                   'Generation, Tripo rigging, source directories, spending and native operations remain separate.']}
    return requests, report


def write_plan(output, root=ROOT):
    output = output.resolve()
    if output.exists():
        raise FileExistsError('Refusing an existing output path: ' + str(output))
    # Validate every pinned input and compose all requests before making output files.
    requests, report = source_plan(root)
    output.mkdir(parents=True)
    for name, raw in requests.items():
        (output / name).write_bytes(raw)
    (output / 'SourceReadiness.json').write_bytes(encoded(report))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New directory; existing paths are rejected.')
    args = parser.parse_args()
    plan = write_plan(args.output)
    print(f"Prepared {plan['character_count']} requests; no network/submission/spend: {args.output}")
