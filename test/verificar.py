# -*- coding: utf-8 -*-
"""Integridade: caminhos, sintaxe, imports, i18n, CSS e uma raiz só nos templates."""
import json, re, os, sys, subprocess
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
falhas, ler = [], lambda p: open(p, encoding="utf-8").read()
mod = json.load(open("module.json", encoding="utf-8"))
for campo in ("esmodules", "styles"):
    for c in mod.get(campo, []):
        if not os.path.exists(c): falhas.append(f"module.json aponta para {c}, inexistente")
for l in mod.get("languages", []):
    if not os.path.exists(l["path"]): falhas.append(f"idioma ausente: {l['path']}")
scripts = {a: ler(f"scripts/{a}") for a in os.listdir("scripts") if a.endswith(".js")}
templates = {a: ler(f"templates/{a}") for a in os.listdir("templates") if a.endswith(".hbs")} if os.path.isdir("templates") else {}
css = ler(mod["styles"][0])
for a in scripts:
    r = subprocess.run(["node", "--check", f"scripts/{a}"], capture_output=True, text=True)
    if r.returncode: falhas.append(f"sintaxe: {a}: {r.stderr.strip().splitlines()[-1]}")
for arq, src in scripts.items():
    for imp in re.findall(r'from "\./([^"]+)"', src):
        if imp not in scripts: falhas.append(f"{arq} importa {imp}, inexistente")
    for t in re.findall(r"templates/([\w-]+\.hbs)", src):
        if t not in templates: falhas.append(f"{arq} usa templates/{t}, inexistente")
# o ApplicationV2 exige um só elemento na raiz de cada template de PARTS (Cinema 0.9.2)
for nome, src in templates.items():
    limpo = re.sub(r"\{\{!--.*?--\}\}", "", src, flags=re.S).strip()
    raiz = re.match(r"<(\w+)", limpo)
    if not raiz or not limpo.endswith(f"</{raiz.group(1)}>") or limpo.count(f"<{raiz.group(1)}") != 1:
        falhas.append(f"{nome}: tem de ter um só elemento na raiz")
pt = json.load(open("lang/pt-BR.json", encoding="utf-8"))
en = json.load(open("lang/en.json", encoding="utf-8"))
usadas = set()
for src in list(scripts.values()) + list(templates.values()) + [ler("module.json")]:
    usadas |= set(re.findall(r'"(ANDARES\.[A-Za-z][\w.]*[A-Za-z])"', src))
# um prefixo de chaves (LOCALIZATION_PREFIXES de um modelo de dados: «ANDARES.Passagem» → «ANDARES.Passagem.FIELDS…»)
# não é uma chave; acrescentá-lo partiria as traduções, que o Foundry expande em objetos
usadas = {k for k in usadas if not any(x.startswith(k + ".") for x in pt)}
for k in sorted(usadas):
    if k not in pt: falhas.append(f"chave {k} ausente em pt-BR")
    if k not in en: falhas.append(f"chave {k} ausente em en")
if set(pt) != set(en): falhas.append("pt-BR e en têm conjuntos de chaves diferentes")
# classes andares-* do template têm de existir no CSS
declaradas = set(re.findall(r"\.(andares-[\w-]+)", css))
# também as que os scripts escrevem em HTML (o papel da mesa é montado em mesa.js)
for grupo in re.findall(r'class="([^"$]+)"', "\n".join(list(templates.values()) + list(scripts.values()))):
    for c in grupo.split():
        if c.startswith("andares-") and c not in declaradas: falhas.append(f'classe "{c}" no template e sem regra no CSS')
print("\n".join(f"  ✖ {f}" for f in falhas) if falhas else "  ✓ integridade ok")
sobra = sorted(set(pt) - usadas)
if sobra: print("  · chaves declaradas e não usadas:", ", ".join(sobra))
sys.exit(1 if falhas else 0)
