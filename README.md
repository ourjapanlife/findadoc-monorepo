# Find a Doc, Japan - Documentation

Documentation site for [Find a Doc, Japan](https://www.findadoc.jp) - connecting people in Japan to healthcare services.

Built with [Zensical](https://zensical.github.io/zensical/).

## Prerequisites

- Python >= 3.10

## Development

```bash
# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the dev server
zensical serve
```

The site will be available at `http://127.0.0.1:8000`.

## Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions on push to `main`.

## License

[BSD 3-Clause](LICENSE)
