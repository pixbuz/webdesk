#!/bin/bash

# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Add jsr:@std/media-types to the project
deno add jsr:@std/media-types