#!/usr/bin/env python3
"""Export runtime charts as editor arrays, or verify their lossless reconstruction."""
import argparse
import base64
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'source/charts'


def read_runtime():
    text = (ROOT / 'assets/songs.js').read_text()
    return json.loads(text.removeprefix('window.SONGS=').rstrip().removesuffix(';'))


def audio_hash(song_id):
    script = (ROOT / f"assets/{song_id.replace('-', '')}_audio.js").read_text()
    match = re.search(r"window\.AUDIO\['([^']+)'\]\s*=\s*'([^']+)'", script)
    if not match or match[1] != song_id:
        raise ValueError(f'Audio key mismatch: {song_id}')
    return hashlib.sha256(base64.b64decode(match[2], validate=True)).hexdigest()


def export(songs):
    manifest = {'format': 'pulsebloom-editable-charts-v1', 'revision': 1,
                'timeUnit': 'seconds', 'chartOffsetUnit': 'milliseconds', 'songs': []}
    OUT.mkdir(parents=True, exist_ok=True)
    for song in songs:
        entry = {'meta': {k: v for k, v in song.items() if k != 'charts'},
                 'audioSha256': audio_hash(song['id']), 'charts': {}}
        for difficulty, chart in song['charts'].items():
            filename = f"{song['id']}_{difficulty}.json"
            (OUT / filename).write_text(json.dumps(chart['objects'], ensure_ascii=False, indent=2) + '\n')
            entry['charts'][difficulty] = {
                'file': filename, 'noteCount': len(chart['objects']),
                'meta': {k: v for k, v in chart.items() if k != 'objects'}}
        manifest['songs'].append(entry)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


def check(songs):
    manifest = json.loads((OUT / 'manifest.json').read_text())
    assert manifest['format'] == 'pulsebloom-editable-charts-v1'
    rebuilt = []
    for entry in manifest['songs']:
        song = dict(entry['meta'])
        assert audio_hash(song['id']) == entry['audioSha256'], f"Audio changed: {song['id']}; re-export after audio edits"
        song['charts'] = {}
        for difficulty, chart in entry['charts'].items():
            objects = json.loads((OUT / chart['file']).read_text())
            assert len(objects) == chart['noteCount'], chart['file']
            song['charts'][difficulty] = dict(chart['meta'], objects=objects)
        rebuilt.append(song)
    assert rebuilt == songs, 'Editable JSON differs from assets/songs.js'
    print(f"PASS: {len(songs)} songs, {sum(len(s['charts']) for s in songs)} charts reconstructed exactly; audio hashes match")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', action='store_true', help='Overwrite editable snapshots from songs.js')
    args = parser.parse_args()
    runtime = read_runtime()
    if args.export:
        export(runtime)
    check(runtime)
