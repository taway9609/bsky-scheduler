from fastapi.templating import Jinja2Templates

# Create templates instance that can be imported by other modules
templates = Jinja2Templates(directory="app/templates")