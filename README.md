# stroppy-site

## Getting started

For local deploy this site needed next actions:

Attention: this instruction is actually for Ubuntu OS, for deploy in another OS, please, refer to

1. Install dependencies:

Install Ruby and other prerequisites:  

```sudo apt-get install ruby-full build-essential zlib1g-dev```

Add environment variables to your ~/.bashrc file to configure the gem installation path:

```sh
echo '# Install Ruby Gems to ~/gems' >> ~/.bashrc
echo 'export GEM_HOME="$HOME/gems"' >> ~/.bashrc
echo 'export PATH="$HOME/gems/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

2. Install Jekyll and Bundler

```gem install jekyll bundler```

3. Change into stroppy-site/source directory.

4. Build the site and make it available on a local server:  

```bundle exec jekyll serve```

5. Browse to ```http://localhost:4000```
