from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.messaging'
    verbose_name = 'Messaging Kafka'

    def ready(self):
        from apps.messaging.kafka_consumer import get_consumer, should_start_consumer

        if should_start_consumer():
            get_consumer().start_background()
