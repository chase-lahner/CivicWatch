from django.db import models

from django.db import models

# Legislators Table (Metadata for legislators)
class Legislator(models.Model):
    legislator_id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=255)
    state = models.CharField(max_length=50)
    chamber = models.CharField(max_length=50, choices=[('House', 'House'), ('Senate', 'Senate')])
    party = models.CharField(max_length=50, choices=[('Democrat', 'Democrat'), ('Republican', 'Republican'), ('Independent', 'Independent')])
    
    def __str__(self):
        return f"{self.name} ({self.party}, {self.state})"

# Twitter Posts Table
class Post(models.Model):
    post_id = models.CharField(max_length=50, primary_key=True)
    url = models.URLField(null=True, blank=True)
    legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="tweets")
    created_at = models.DateTimeField()
    text = models.TextField()
    attachment = models.URLField(null=True, blank=True)
    state = models.CharField(max_length=50)
    chamber = models.CharField(max_length=50)
    party = models.CharField(max_length=50)
    retweet_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    count_misinfo = models.IntegerField(default=0)
    civility_score = models.FloatField(null=True, blank=True)
    interaction_score = models.FloatField(null=True, blank=True)
    overperforming_score = models.FloatField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.legislator.name} - {self.created_at}"

# Interactions Between Legislators (Mention, Reply, Share)
class LegislatorInteraction(models.Model):
    date = models.DateTimeField()
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    source_legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="sent_interactions")
    target_legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="received_interactions")
    interaction_type = models.CharField(max_length=20, choices=[('mention', 'Mention'), ('reply', 'Reply'), ('share', 'Share')])

    def __str__(self):
        return f"{self.source_legislator.name} → {self.target_legislator.name} ({self.interaction_type})"

# Topic and Keyword Metadata (Optional)
class Topic(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.name

class Keyword(models.Model):
    text = models.CharField(max_length=255, unique=True)
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="keywords")

    def __str__(self):
        return f"{self.text} ({self.topic.name})"
