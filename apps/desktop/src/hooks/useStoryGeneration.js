import { useState, useEffect } from 'react';

export function useStoryGeneration({
  topic,
  numSlides,
  selectedStyle,
  imageSize,
  imageProvider,
  inputMode,
  pastedText,
  brandId,
  onSaveResearch,
  onSaveImages
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState(null);
  const [storyPlan, setStoryPlan] = useState(null);
  const [expectedSlides, setExpectedSlides] = useState(0);
  const [currentGeneratingSlide, setCurrentGeneratingSlide] = useState(0);
  const [generatingSlides, setGeneratingSlides] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [generatedSlides, setGeneratedSlides] = useState([]);
  const [storyCaption, setStoryCaption] = useState('');
  const [storyHashtags, setStoryHashtags] = useState([]);
  const [completedResearch, setCompletedResearch] = useState(null);
  const [researchCollapsed, setResearchCollapsed] = useState(true);

  // Cycle through slides during generation
  useEffect(() => {
    if (generatingPhase === 'images' && currentGeneratingSlide < expectedSlides) {
      const timer = setTimeout(() => {
        setCurrentGeneratingSlide(prev => Math.min(prev + 1, expectedSlides));
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [generatingPhase, currentGeneratingSlide, expectedSlides]);

  // Build aesthetic string from JSON style
  const buildAestheticString = (style) => {
    if (!style) return '';
    return `${style.art_style || ''} with ${style.color_palette || ''}, ${style.lighting || ''}, ${style.texture || ''}, ${style.typography_style || ''}, ${style.background_style || ''}`;
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (inputMode === 'topic' && !topic) return;
    if (inputMode === 'paste' && !pastedText.trim()) return;

    setIsGenerating(true);
    setGeneratingPhase('research');
    setGeneratedImages([]);
    setGeneratedSlides([]);
    setStoryCaption('');
    setStoryHashtags([]);
    setStoryPlan(null);
    setCompletedResearch(null);
    setResearchCollapsed(true);

    // Build aesthetic from selected style
    const aestheticString = buildAestheticString(selectedStyle);

    try {
      let response;

      if (inputMode === 'paste') {
        response = await fetch('http://localhost:8000/plan_from_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: pastedText,
            num_slides: numSlides,
            aesthetic: aestheticString,
            topic: topic || 'Custom Content',
            image_size: imageSize
          }),
        });
      } else {
        response = await fetch('http://localhost:8000/plan_story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            num_slides: numSlides,
            aesthetic: aestheticString,
            image_size: imageSize
          }),
        });
      }

      if (!response.ok) throw new Error('Planning failed');

      const data = await response.json();

      // Override aesthetic with selected style if available
      if (selectedStyle && data.plan) {
        data.plan.aesthetic = {
          art_style: selectedStyle.art_style,
          color_palette: selectedStyle.color_palette,
          lighting: selectedStyle.lighting,
          texture: selectedStyle.texture,
          typography_style: selectedStyle.typography_style,
          background_style: selectedStyle.background_style
        };
        data.plan.style_name = selectedStyle.name;
      }

      setStoryPlan(data.plan);
    } catch (err) {
      console.error(err);
      alert("Failed to plan story. Check backend.");
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleConfirmPlan = async () => {
    if (!storyPlan) return;

    // Save research FIRST (before attempting image generation)
    const newResearchBoard = {
      id: Date.now(),
      topic: storyPlan.topic,
      aesthetic: storyPlan.aesthetic,
      style_name: storyPlan.style_name,
      slides: storyPlan.slides,
      sources: storyPlan.sources,
      caption: storyPlan.caption,
      hashtags: storyPlan.hashtags,
      image_size: storyPlan.image_size || imageSize,
      createdAt: new Date().toISOString()
    };
    onSaveResearch(newResearchBoard);
    setCompletedResearch(storyPlan);

    setIsGenerating(true);
    setGeneratingPhase('images');
    setExpectedSlides(storyPlan.slides?.length || 0);
    setGeneratingSlides(storyPlan.slides || []);
    setCurrentGeneratingSlide(1);

    try {
      // Ensure image_size is included in the plan
      const planWithSize = {
        ...storyPlan,
        image_size: storyPlan.image_size || imageSize
      };

      const response = await fetch('http://localhost:8000/generate_from_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planWithSize,
          provider: imageProvider,
          brand_id: brandId || null,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();

      // Only save images if we got some
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
        setGeneratedSlides(storyPlan.slides);
        setStoryCaption(storyPlan.caption || '');
        setStoryHashtags(storyPlan.hashtags || []);
        setResearchCollapsed(true);

        const newImageBoard = {
          id: Date.now(),
          topic: storyPlan.topic,
          images: data.images,
          slides: storyPlan.slides,
          caption: storyPlan.caption,
          hashtags: storyPlan.hashtags,
          aesthetic: storyPlan.aesthetic,
          style_name: storyPlan.style_name,
          image_size: storyPlan.image_size || imageSize,
          createdAt: new Date().toISOString()
        };

        onSaveImages(newImageBoard);
        setStoryPlan(null);
        return newImageBoard;
      } else {
        // No images generated, but research is saved
        alert("No images were generated. Research has been saved - you can try again from the Boards.");
        setStoryPlan(null);
        return null;
      }
    } catch (err) {
      console.error(err);
      alert("Image generation failed. Research has been saved - you can try again from the Boards.");
      setStoryPlan(null);
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleRegenerateImages = async (researchToUse = null) => {
    const research = researchToUse || completedResearch;
    if (!research) return;

    setCompletedResearch(research);
    setIsGenerating(true);
    setGeneratingPhase('images');
    setExpectedSlides(research.slides?.length || 0);
    setGeneratingSlides(research.slides || []);
    setCurrentGeneratingSlide(1);
    setResearchCollapsed(true);

    try {
      // Ensure image_size is included
      const planWithSize = {
        ...research,
        image_size: research.image_size || imageSize
      };

      const response = await fetch('http://localhost:8000/generate_from_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planWithSize,
          provider: imageProvider,
        }),
      });

      if (!response.ok) throw new Error('Regeneration failed');

      const data = await response.json();
      setGeneratedImages(data.images);
      setGeneratedSlides(research.slides);
      setStoryCaption(research.caption || '');
      setStoryHashtags(research.hashtags || []);

      const newImageBoard = {
        id: Date.now(),
        topic: research.topic,
        images: data.images,
        slides: research.slides,
        caption: research.caption,
        hashtags: research.hashtags,
        aesthetic: research.aesthetic,
        style_name: research.style_name,
        image_size: research.image_size || imageSize,
        createdAt: new Date().toISOString()
      };

      onSaveImages(newImageBoard);

      return newImageBoard;
    } catch (err) {
      console.error(err);
      alert("Failed to regenerate images.");
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleEditAesthetic = (field, value) => {
    if (!storyPlan) return;
    setStoryPlan({
      ...storyPlan,
      aesthetic: { ...storyPlan.aesthetic, [field]: value }
    });
  };

  const handleEditSlide = (slideIndex, field, value) => {
    if (!storyPlan) return;
    const updatedSlides = [...storyPlan.slides];
    updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], [field]: value };
    setStoryPlan({ ...storyPlan, slides: updatedSlides });
  };

  const handleEditCaption = (value) => {
    if (!storyPlan) return;
    setStoryPlan({ ...storyPlan, caption: value });
  };

  const handleCancel = () => {
    setIsGenerating(false);
    setGeneratingPhase(null);
    setStoryPlan(null);
  };

  // Update plan aesthetic when style changes during generation
  const updatePlanStyle = (newStyle) => {
    if (storyPlan && newStyle) {
      setStoryPlan({
        ...storyPlan,
        aesthetic: {
          art_style: newStyle.art_style,
          color_palette: newStyle.color_palette,
          lighting: newStyle.lighting,
          texture: newStyle.texture,
          typography_style: newStyle.typography_style,
          background_style: newStyle.background_style
        },
        style_name: newStyle.name
      });
    }
  };

  return {
    isGenerating,
    generatingPhase,
    storyPlan,
    setStoryPlan,
    expectedSlides,
    currentGeneratingSlide,
    setCurrentGeneratingSlide,
    generatingSlides,
    generatedImages,
    generatedSlides,
    storyCaption,
    storyHashtags,
    completedResearch,
    setCompletedResearch,
    researchCollapsed,
    setResearchCollapsed,
    handleGenerate,
    handleConfirmPlan,
    handleRegenerateImages,
    handleEditAesthetic,
    handleEditSlide,
    handleEditCaption,
    handleCancel,
    updatePlanStyle
  };
}
