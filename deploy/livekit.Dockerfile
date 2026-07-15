# LiveKit SFU image for the develop deploy: bakes livekit.yaml into the image so no host bind-mount
# is needed. The CI runner deploys onto the host docker, which cannot see the runner's checked-out
# workspace, so a `volumes: ./deploy/livekit.yaml:...` mount resolves to nothing and LiveKit fails
# to start. Baking the config in is the same pattern the kmb-livekit boilerplate uses.
FROM livekit/livekit-server:latest
COPY livekit.yaml /etc/livekit.yaml
CMD ["--config", "/etc/livekit.yaml"]
