FROM zenika/alpine-chrome:latest

# Add a non-root user
RUN adduser -D myuser

# Install additional packages
RUN apk add --no-cache \
    bash \
    curl \
    nss \
    freetype \
    harfbuzz \
    libxslt \
    libffi \
    ttf-dejavu

# Switch to the non-root user
USER myuser

# Expose the port
EXPOSE 9222

# Start Chromium with remote debugging enabled
CMD ["chromium-browser", "--no-sandbox", "--remote-debugging-port=9222"]
